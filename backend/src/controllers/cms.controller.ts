import crypto from 'crypto';
import { Request, Response } from 'express';
import { ContentType, Prisma } from '@prisma/client';
import prisma from '../config/database';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../types';
import {
  ContentValidationError,
  hasUnpublishedChanges,
  normalizeContentValue,
} from '../utils/cms';

/**
 * Content is addressed by the dotted keys the site already uses for i18n. A
 * block is an *override*: when no row exists the client falls back to the
 * bundled locale JSON, so an empty database renders a correct site.
 */

type BlockMap = Record<string, Prisma.JsonValue | null>;
type TypeMap = Record<string, ContentType>;

const toMaps = (rows: { key: string; type: ContentType; value: Prisma.JsonValue | null }[]) => {
  const blocks: BlockMap = {};
  const types: TypeMap = {};
  for (const row of rows) {
    blocks[row.key] = row.value;
    types[row.key] = row.type;
  }
  return { blocks, types };
};

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * The whole published content map for a locale in one request — per-element
 * fetching would be hundreds of round trips. Served with an ETag so repeat
 * visits revalidate in a few bytes instead of re-downloading the payload.
 */
export const getPublishedContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const locale = String(req.query.locale || 'en');

    const rows = await prisma.contentBlock.findMany({
      where: { locale, publishedAt: { not: null } },
      select: { key: true, type: true, publishedValue: true, updatedAt: true },
    });

    const { blocks, types } = toMaps(
      rows.map((r) => ({ key: r.key, type: r.type, value: r.publishedValue }))
    );

    const etag = `W/"${crypto
      .createHash('sha1')
      .update(`${locale}:${rows.length}:${rows.reduce((max, r) => Math.max(max, r.updatedAt.getTime()), 0)}`)
      .digest('hex')}"`;

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('ETag', etag);
    // Always revalidate. A freshness window here means a publish is invisible
    // until it expires — measured at up to 30s with max-age=30, and up to five
    // minutes once stale-while-revalidate was in play. Revalidation is cheap
    // because the ETag turns the repeat request into a bodyless 304; publishing
    // that does not appear immediately is not.
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.json({ success: true, data: { locale, blocks, types } });
  } catch (error) {
    logger.error('getPublishedContent error:', error);
    res.status(500).json({ success: false, message: 'Failed to load content' });
  }
};

// ─── Admin: read ──────────────────────────────────────────────────────────────

/** Draft values plus the per-key metadata edit mode needs (dirty flags, author). */
export const getDraftContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const locale = String(req.query.locale || 'en');

    const rows = await prisma.contentBlock.findMany({
      where: { locale },
      select: {
        key: true, type: true, draftValue: true, publishedValue: true,
        publishedAt: true, scheduledAt: true, updatedAt: true,
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const { blocks, types } = toMaps(
      rows.map((r) => ({ key: r.key, type: r.type, value: r.draftValue }))
    );

    const meta: Record<string, unknown> = {};
    for (const r of rows) {
      meta[r.key] = {
        dirty: hasUnpublishedChanges(r.draftValue, r.publishedValue),
        published: r.publishedAt !== null,
        publishedAt: r.publishedAt,
        scheduledAt: r.scheduledAt,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy ? `${r.updatedBy.firstName} ${r.updatedBy.lastName}`.trim() : null,
      };
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: { locale, blocks, types, meta } });
  } catch (error) {
    logger.error('getDraftContent error:', error);
    res.status(500).json({ success: false, message: 'Failed to load draft content' });
  }
};

// ─── Admin: write ─────────────────────────────────────────────────────────────

interface IncomingBlock {
  key: string;
  type: ContentType;
  value: unknown;
  page?: string | null;
  label?: string | null;
}

/**
 * Batch draft save. Autosave sends every dirty block at once, so this is a
 * single transaction rather than one request per element.
 */
export const saveDrafts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const locale = String(req.body.locale || 'en');
    const incoming = (req.body.blocks || []) as IncomingBlock[];
    const userId = req.user?.id ?? null;

    const prepared: { block: IncomingBlock; value: Prisma.InputJsonValue }[] = [];
    for (const block of incoming) {
      try {
        prepared.push({
          block,
          value: normalizeContentValue(block.type, block.value) as Prisma.InputJsonValue,
        });
      } catch (e) {
        const message = e instanceof ContentValidationError ? e.message : 'Invalid content value';
        res.status(400).json({ success: false, message: `${block.key}: ${message}` });
        return;
      }
    }

    await prisma.$transaction(
      prepared.map(({ block, value }) =>
        prisma.contentBlock.upsert({
          where: { key_locale: { key: block.key, locale } },
          create: {
            key: block.key,
            locale,
            type: block.type,
            draftValue: value,
            page: block.page ?? null,
            label: block.label ?? null,
            updatedById: userId,
          },
          update: {
            type: block.type,
            draftValue: value,
            // Keep whatever grouping metadata the caller supplied, but never
            // blank an existing label because a later caller omitted it.
            ...(block.page != null ? { page: block.page } : {}),
            ...(block.label != null ? { label: block.label } : {}),
            updatedById: userId,
          },
        })
      )
    );

    res.json({ success: true, data: { saved: prepared.length, savedAt: new Date().toISOString() } });
  } catch (error) {
    logger.error('saveDrafts error:', error);
    res.status(500).json({ success: false, message: 'Failed to save changes' });
  }
};

/**
 * Copy draft → published and record a revision. `keys` publishes a subset;
 * omitting it publishes every dirty block in the locale.
 */
export const publishContent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const locale = String(req.body.locale || 'en');
    const keys = Array.isArray(req.body.keys) ? (req.body.keys as string[]) : null;
    const label = typeof req.body.label === 'string' ? req.body.label.slice(0, 200) : null;
    const userId = req.user?.id ?? null;

    const candidates = await prisma.contentBlock.findMany({
      where: { locale, ...(keys ? { key: { in: keys } } : {}) },
      select: { id: true, key: true, draftValue: true, publishedValue: true },
    });

    const dirty = candidates.filter((b) => hasUnpublishedChanges(b.draftValue, b.publishedValue));
    if (dirty.length === 0) {
      res.json({ success: true, data: { published: 0, publishedAt: null } });
      return;
    }

    const publishedAt = new Date();
    await prisma.$transaction([
      ...dirty.map((b) =>
        prisma.contentBlock.update({
          where: { id: b.id },
          data: {
            publishedValue: b.draftValue ?? Prisma.DbNull,
            publishedAt,
            scheduledAt: null,
            updatedById: userId,
          },
        })
      ),
      // One revision per block per publish — this is what history restores from.
      prisma.contentRevision.createMany({
        data: dirty.map((b) => ({
          blockId: b.id,
          value: (b.draftValue ?? Prisma.DbNull) as Prisma.InputJsonValue,
          label,
          createdById: userId,
        })),
      }),
    ]);

    res.json({
      success: true,
      data: { published: dirty.length, publishedAt: publishedAt.toISOString(), keys: dirty.map((b) => b.key) },
    });
  } catch (error) {
    logger.error('publishContent error:', error);
    res.status(500).json({ success: false, message: 'Failed to publish' });
  }
};

/**
 * Throw away unpublished edits. Blocks that were never published have no
 * published value to fall back to, so the row is removed entirely and the
 * client falls back to the bundled locale JSON.
 */
export const discardDrafts = async (req: Request, res: Response): Promise<void> => {
  try {
    const locale = String(req.body.locale || 'en');
    const keys = Array.isArray(req.body.keys) ? (req.body.keys as string[]) : null;

    const blocks = await prisma.contentBlock.findMany({
      where: { locale, ...(keys ? { key: { in: keys } } : {}) },
      select: { id: true, publishedAt: true, publishedValue: true },
    });

    const neverPublished = blocks.filter((b) => b.publishedAt === null).map((b) => b.id);
    const revertable = blocks.filter((b) => b.publishedAt !== null);

    await prisma.$transaction([
      ...(neverPublished.length
        ? [prisma.contentBlock.deleteMany({ where: { id: { in: neverPublished } } })]
        : []),
      ...revertable.map((b) =>
        prisma.contentBlock.update({
          where: { id: b.id },
          data: { draftValue: (b.publishedValue ?? Prisma.DbNull) as Prisma.InputJsonValue },
        })
      ),
    ]);

    res.json({ success: true, data: { discarded: blocks.length } });
  } catch (error) {
    logger.error('discardDrafts error:', error);
    res.status(500).json({ success: false, message: 'Failed to discard changes' });
  }
};

// ─── Admin: history ───────────────────────────────────────────────────────────

export const getRevisions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const locale = String(req.query.locale || 'en');

    const block = await prisma.contentBlock.findUnique({
      where: { key_locale: { key, locale } },
      select: { id: true, draftValue: true, publishedValue: true },
    });
    if (!block) {
      res.json({ success: true, data: { revisions: [], current: null } });
      return;
    }

    const revisions = await prisma.contentRevision.findMany({
      where: { blockId: block.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, value: true, label: true, createdAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    res.json({
      success: true,
      data: {
        current: { draft: block.draftValue, published: block.publishedValue },
        revisions: revisions.map((r) => ({
          id: r.id,
          value: r.value,
          label: r.label,
          createdAt: r.createdAt,
          author: r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}`.trim() : 'Unknown',
        })),
      },
    });
  } catch (error) {
    logger.error('getRevisions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load history' });
  }
};

/** Restore into the *draft* — the editor still has to publish it deliberately. */
export const restoreRevision = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const locale = String(req.body.locale || 'en');
    const { revisionId } = req.body;

    const block = await prisma.contentBlock.findUnique({
      where: { key_locale: { key, locale } },
      select: { id: true },
    });
    if (!block) {
      res.status(404).json({ success: false, message: 'Content not found' });
      return;
    }

    const revision = await prisma.contentRevision.findFirst({
      where: { id: revisionId, blockId: block.id },
      select: { value: true },
    });
    if (!revision) {
      res.status(404).json({ success: false, message: 'Revision not found' });
      return;
    }

    const updated = await prisma.contentBlock.update({
      where: { id: block.id },
      data: {
        draftValue: (revision.value ?? Prisma.DbNull) as Prisma.InputJsonValue,
        updatedById: req.user?.id ?? null,
      },
      select: { key: true, draftValue: true },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('restoreRevision error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore revision' });
  }
};

// ─── Admin: search and replace ────────────────────────────────────────────────

const matchesText = (value: Prisma.JsonValue | null, needle: string): boolean =>
  JSON.stringify(value ?? '').toLowerCase().includes(needle.toLowerCase());

export const searchContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim();
    const locale = req.query.locale ? String(req.query.locale) : undefined;
    if (!q) {
      res.json({ success: true, data: { results: [] } });
      return;
    }

    // JSONB shape varies per content type, so filtering happens in application
    // code. Bounded by the block count, which stays in the low thousands.
    const rows = await prisma.contentBlock.findMany({
      where: locale ? { locale } : {},
      select: { key: true, locale: true, type: true, page: true, label: true, draftValue: true },
    });

    const results = rows
      .filter((r) => r.key.toLowerCase().includes(q.toLowerCase()) || matchesText(r.draftValue, q))
      .slice(0, 200);

    res.json({ success: true, data: { results } });
  } catch (error) {
    logger.error('searchContent error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

/**
 * Global find-and-replace across draft values. Text-bearing types only —
 * rewriting URLs or icon names by substring would corrupt them.
 */
export const replaceContent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const find = String(req.body.find || '');
    const replace = String(req.body.replace ?? '');
    const locale = req.body.locale ? String(req.body.locale) : undefined;
    const dryRun = Boolean(req.body.dryRun);

    if (!find) {
      res.status(400).json({ success: false, message: 'Nothing to find' });
      return;
    }

    const rows = await prisma.contentBlock.findMany({
      where: { ...(locale ? { locale } : {}), type: { in: ['TEXT', 'RICHTEXT'] } },
      select: { id: true, key: true, locale: true, type: true, draftValue: true },
    });

    const changes = rows
      .filter((r) => typeof r.draftValue === 'string' && r.draftValue.includes(find))
      .map((r) => ({
        id: r.id,
        key: r.key,
        locale: r.locale,
        before: r.draftValue as string,
        after: (r.draftValue as string).split(find).join(replace),
      }));

    if (!dryRun && changes.length) {
      await prisma.$transaction(
        changes.map((c) =>
          prisma.contentBlock.update({
            where: { id: c.id },
            data: { draftValue: c.after, updatedById: req.user?.id ?? null },
          })
        )
      );
    }

    res.json({ success: true, data: { dryRun, matched: changes.length, changes: changes.slice(0, 100) } });
  } catch (error) {
    logger.error('replaceContent error:', error);
    res.status(500).json({ success: false, message: 'Replace failed' });
  }
};

// ─── Scheduled publishing ─────────────────────────────────────────────────────

export const scheduleContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const locale = String(req.body.locale || 'en');
    const keys = Array.isArray(req.body.keys) ? (req.body.keys as string[]) : [];
    const at = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;

    if (at && Number.isNaN(at.getTime())) {
      res.status(400).json({ success: false, message: 'scheduledAt is not a valid date' });
      return;
    }

    const { count } = await prisma.contentBlock.updateMany({
      where: { locale, ...(keys.length ? { key: { in: keys } } : {}) },
      data: { scheduledAt: at },
    });

    res.json({ success: true, data: { scheduled: count, scheduledAt: at } });
  } catch (error) {
    logger.error('scheduleContent error:', error);
    res.status(500).json({ success: false, message: 'Failed to schedule' });
  }
};

/**
 * Publish anything whose schedule has come due. Called on an interval from
 * index.ts; safe to run concurrently because each update clears scheduledAt.
 */
export const publishScheduled = async (): Promise<number> => {
  const due = await prisma.contentBlock.findMany({
    where: { scheduledAt: { not: null, lte: new Date() } },
    select: { id: true, draftValue: true, publishedValue: true },
  });

  const dirty = due.filter((b) => hasUnpublishedChanges(b.draftValue, b.publishedValue));
  if (due.length === 0) return 0;

  const publishedAt = new Date();
  await prisma.$transaction([
    ...due.map((b) =>
      prisma.contentBlock.update({
        where: { id: b.id },
        data: {
          publishedValue: (b.draftValue ?? Prisma.DbNull) as Prisma.InputJsonValue,
          publishedAt,
          scheduledAt: null,
        },
      })
    ),
    prisma.contentRevision.createMany({
      data: dirty.map((b) => ({
        blockId: b.id,
        value: (b.draftValue ?? Prisma.DbNull) as Prisma.InputJsonValue,
        label: 'Scheduled publish',
      })),
    }),
  ]);

  if (due.length) logger.info(`Scheduled publish released ${due.length} content block(s)`);
  return due.length;
};

// ─── Site settings ────────────────────────────────────────────────────────────

/** Settings the public site needs: theme colours, logo, favicon, maintenance. */
const PUBLIC_SETTING_KEYS = [
  'theme.primary', 'theme.secondary', 'theme.accent',
  'site.logo', 'site.favicon', 'site.name',
  'site.maintenance', 'analytics.gaId',
];

export const getPublicSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: PUBLIC_SETTING_KEYS } } });
    const settings: Record<string, Prisma.JsonValue> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('getPublicSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
};

export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.siteSetting.findMany();
    const settings: Record<string, Prisma.JsonValue> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const entries = Object.entries((req.body.settings || {}) as Record<string, unknown>);
    if (!entries.length) {
      res.status(400).json({ success: false, message: 'No settings supplied' });
      return;
    }
    if (entries.length > 100) {
      res.status(400).json({ success: false, message: 'Too many settings in one request' });
      return;
    }

    const userId = req.user?.id ?? null;
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue, updatedById: userId },
          update: { value: value as Prisma.InputJsonValue, updatedById: userId },
        })
      )
    );

    res.json({ success: true, data: { updated: entries.length } });
  } catch (error) {
    logger.error('updateSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
};
