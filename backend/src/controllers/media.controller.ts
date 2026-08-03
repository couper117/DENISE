import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../types';
import { destroyImage, fileToImage } from '../utils/uploads';
import { isCloudinaryConfigured } from '../config/cloudinary';
import { stripTags } from '../utils/cms';

type StoredFile = Express.Multer.File & { width?: number; height?: number };

const parseTags = (raw: unknown): string[] => {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  return [...new Set(list.map((t) => stripTags(String(t)).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
};

// ─── Assets ───────────────────────────────────────────────────────────────────

/** Drag-and-drop can drop many files at once, so upload is always multi-file. */
export const uploadAssets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const files = (req.files as StoredFile[] | undefined) ?? [];
    if (!files.length) {
      res.status(400).json({ success: false, message: 'No files uploaded' });
      return;
    }

    const folderId = req.body.folderId || null;
    if (folderId) {
      const folder = await prisma.mediaFolder.findUnique({ where: { id: folderId }, select: { id: true } });
      if (!folder) {
        res.status(400).json({ success: false, message: 'Folder not found' });
        return;
      }
    }

    const tags = parseTags(req.body.tags);
    const created = await prisma.$transaction(
      files.map((file) => {
        const { url, publicId } = fileToImage(req, file);
        return prisma.mediaAsset.create({
          data: {
            url,
            publicId,
            filename: stripTags(file.originalname).slice(0, 300),
            mimeType: file.mimetype,
            bytes: file.size ?? 0,
            // Cloudinary reports dimensions on the upload result; the local disk
            // fallback does not, and they are only used for display hints.
            width: file.width ?? null,
            height: file.height ?? null,
            tags,
            folderId,
            uploadedById: req.user?.id ?? null,
          },
        });
      })
    );

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    logger.error('uploadAssets error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
};

export const listAssets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const search = String(req.query.search || '').trim();
    const tag = String(req.query.tag || '').trim().toLowerCase();

    // "root" means the unfiled top level; omitting folderId means "everywhere".
    const folderParam = req.query.folderId;
    const folderWhere =
      folderParam === undefined ? {} : folderParam === 'root' ? { folderId: null } : { folderId: String(folderParam) };

    const where: Prisma.MediaAssetWhereInput = {
      ...folderWhere,
      ...(search
        ? {
            OR: [
              { filename: { contains: search, mode: 'insensitive' } },
              { alt: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    };

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: assets,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('listAssets error:', error);
    res.status(500).json({ success: false, message: 'Failed to list media' });
  }
};

/** Rename, re-tag, set alt text, or move between folders. */
export const updateAsset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { filename, alt, tags, folderId } = req.body;

    const data: Prisma.MediaAssetUpdateInput = {};
    if (filename !== undefined) data.filename = stripTags(String(filename)).slice(0, 300);
    if (alt !== undefined) data.alt = stripTags(String(alt)).slice(0, 300);
    if (tags !== undefined) data.tags = parseTags(tags);
    if (folderId !== undefined) {
      data.folder = folderId ? { connect: { id: String(folderId) } } : { disconnect: true };
    }

    if (!Object.keys(data).length) {
      res.status(400).json({ success: false, message: 'Nothing to update' });
      return;
    }

    const asset = await prisma.mediaAsset.update({ where: { id }, data });
    res.json({ success: true, data: asset });
  } catch (error) {
    logger.error('updateAsset error:', error);
    res.status(500).json({ success: false, message: 'Failed to update asset' });
  }
};

/**
 * Deleting an asset removes the stored file too. Content blocks referencing it
 * keep their URL — the editor is warned by the usage count rather than having
 * the reference silently rewritten, which would blank a live page.
 */
export const deleteAsset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { publicId: true } });
    if (!asset) {
      res.status(404).json({ success: false, message: 'Asset not found' });
      return;
    }

    await destroyImage(asset.publicId);
    await prisma.mediaAsset.delete({ where: { id } });

    res.json({ success: true, message: 'Asset deleted' });
  } catch (error) {
    logger.error('deleteAsset error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete asset' });
  }
};

/**
 * How many content blocks reference this asset's URL. Shown before a delete so
 * an editor does not blank a live page by accident.
 */
export const getAssetUsage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { url: true } });
    if (!asset) {
      res.status(404).json({ success: false, message: 'Asset not found' });
      return;
    }

    const blocks = await prisma.contentBlock.findMany({
      where: { type: { in: ['IMAGE', 'JSON', 'RICHTEXT'] } },
      select: { key: true, locale: true, draftValue: true, publishedValue: true },
    });

    const used = blocks.filter(
      (b) =>
        JSON.stringify(b.draftValue ?? '').includes(asset.url) ||
        JSON.stringify(b.publishedValue ?? '').includes(asset.url)
    );

    res.json({ success: true, data: { count: used.length, blocks: used.map(({ key, locale }) => ({ key, locale })) } });
  } catch (error) {
    logger.error('getAssetUsage error:', error);
    res.status(500).json({ success: false, message: 'Failed to check usage' });
  }
};

/**
 * Build a cropped/resized delivery URL. On Cloudinary this is a transformation
 * (no re-upload, cached at the edge). Without Cloudinary the original URL is
 * returned unchanged and the caller is told cropping is unavailable, which is
 * honest rather than silently serving an uncropped image.
 */
export const buildTransform = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { width, height, x, y, crop = 'fill' } = req.body as Record<string, number | string>;

    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { url: true, publicId: true } });
    if (!asset) {
      res.status(404).json({ success: false, message: 'Asset not found' });
      return;
    }

    if (!isCloudinaryConfigured || !asset.publicId || asset.publicId.startsWith('local:')) {
      res.json({ success: true, data: { url: asset.url, transformed: false } });
      return;
    }

    const parts = [
      x !== undefined && y !== undefined ? `x_${Math.round(Number(x))},y_${Math.round(Number(y))},c_crop` : null,
      width ? `w_${Math.round(Number(width))}` : null,
      height ? `h_${Math.round(Number(height))}` : null,
      `c_${crop}`,
      'q_auto',
      'f_auto',
    ].filter(Boolean);

    // /upload/ is the documented insertion point for delivery transformations.
    const url = asset.url.replace('/upload/', `/upload/${parts.join(',')}/`);
    res.json({ success: true, data: { url, transformed: true } });
  } catch (error) {
    logger.error('buildTransform error:', error);
    res.status(500).json({ success: false, message: 'Failed to build transform' });
  }
};

// ─── Folders ──────────────────────────────────────────────────────────────────

export const listFolders = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const folders = await prisma.mediaFolder.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: true, children: true } } },
    });
    res.json({ success: true, data: folders });
  } catch (error) {
    logger.error('listFolders error:', error);
    res.status(500).json({ success: false, message: 'Failed to list folders' });
  }
};

export const createFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const name = stripTags(String(req.body.name || '')).trim().slice(0, 100);
    const parentId = req.body.parentId || null;
    if (!name) {
      res.status(400).json({ success: false, message: 'Folder name is required' });
      return;
    }

    const folder = await prisma.mediaFolder.create({ data: { name, parentId } });
    res.status(201).json({ success: true, data: folder });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A folder with that name already exists here' });
      return;
    }
    logger.error('createFolder error:', error);
    res.status(500).json({ success: false, message: 'Failed to create folder' });
  }
};

export const renameFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const name = stripTags(String(req.body.name || '')).trim().slice(0, 100);
    if (!name) {
      res.status(400).json({ success: false, message: 'Folder name is required' });
      return;
    }
    const folder = await prisma.mediaFolder.update({ where: { id }, data: { name } });
    res.json({ success: true, data: folder });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A folder with that name already exists here' });
      return;
    }
    logger.error('renameFolder error:', error);
    res.status(500).json({ success: false, message: 'Failed to rename folder' });
  }
};

/**
 * Deleting a folder cascades to sub-folders (schema) but never to assets: those
 * are detached to the root so a mis-click cannot destroy the library.
 */
export const deleteFolder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.$transaction([
      prisma.mediaAsset.updateMany({ where: { folderId: id }, data: { folderId: null } }),
      prisma.mediaFolder.delete({ where: { id } }),
    ]);
    res.json({ success: true, message: 'Folder deleted; its images were moved to the root' });
  } catch (error) {
    logger.error('deleteFolder error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete folder' });
  }
};
