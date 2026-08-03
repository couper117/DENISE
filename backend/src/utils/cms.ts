import sanitizeHtml from 'sanitize-html';
import { ContentType } from '@prisma/client';

/**
 * Rich text is authored by admins but rendered to every visitor, so a rogue or
 * compromised editor account would otherwise be a stored-XSS vector. The
 * allowlist mirrors what the toolbar can actually produce — anything else is a
 * sign the payload did not come from the editor.
 */
const RICHTEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span',
    'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'blockquote',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['style'],
    p: ['style'],
    h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
  },
  // Only the properties the toolbar exposes; `style` is otherwise a bypass.
  allowedStyles: {
    '*': {
      'text-align': [/^left$|^right$|^center$|^justify$/],
      color: [/^#(?:[0-9a-fA-F]{3}){1,2}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      'font-size': [/^\d{1,3}(?:\.\d+)?(?:px|rem|em)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // Anything opening a new tab must not be able to reach back via window.opener.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target === '_blank'
        ? { ...attribs, rel: 'noopener noreferrer' }
        : attribs,
    }),
  },
};

export const sanitizeRichText = (html: string): string => sanitizeHtml(html, RICHTEXT_OPTIONS);

/** Plain-text fields must not smuggle markup into a heading or a button label. */
export const stripTags = (text: string): string =>
  sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });

const SAFE_URL = /^(https?:\/\/|\/|mailto:|tel:|#)/i;

/**
 * Rejects `javascript:`, `data:` and friends. Relative paths and anchors are
 * allowed because most links on the site are internal routes.
 */
export const isSafeUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 2048 && SAFE_URL.test(value.trim());

export type ContentValue = string | number | boolean | null | ContentValue[] | { [k: string]: ContentValue };

const MAX_TEXT = 20_000;
const MAX_JSON_NODES = 2_000;

const countNodes = (value: unknown, depth = 0): number => {
  if (depth > 12) throw new Error('Content is nested too deeply');
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + countNodes(v, depth + 1), 1);
  if (value && typeof value === 'object') {
    return Object.values(value).reduce<number>((n, v) => n + countNodes(v, depth + 1), 1);
  }
  return 1;
};

/** Recursively sanitise every string inside a JSON collection. */
const sanitizeDeep = (value: ContentValue): ContentValue => {
  if (typeof value === 'string') return stripTags(value).slice(0, MAX_TEXT);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, ContentValue> = {};
    for (const [k, v] of Object.entries(value)) {
      // `href`/`url` keys keep their punctuation but must still be safe schemes.
      if ((k === 'href' || k === 'url' || k === 'src') && typeof v === 'string') {
        out[k] = isSafeUrl(v) ? v.trim() : '';
      } else if (k === 'html' && typeof v === 'string') {
        out[k] = sanitizeRichText(v);
      } else {
        out[k] = sanitizeDeep(v);
      }
    }
    return out;
  }
  return value;
};

export class ContentValidationError extends Error {}

/**
 * Normalise and sanitise a submitted value for its declared type. Throws
 * ContentValidationError with a message safe to show the editor.
 */
export const normalizeContentValue = (type: ContentType, raw: unknown): ContentValue => {
  switch (type) {
    case 'TEXT': {
      if (typeof raw !== 'string') throw new ContentValidationError('Text content must be a string');
      return stripTags(raw).slice(0, MAX_TEXT);
    }
    case 'RICHTEXT': {
      if (typeof raw !== 'string') throw new ContentValidationError('Rich text content must be a string');
      return sanitizeRichText(raw.slice(0, MAX_TEXT));
    }
    case 'NUMBER': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) throw new ContentValidationError('Value must be a number');
      return n;
    }
    case 'COLOR': {
      if (typeof raw !== 'string' || !/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(raw.trim())) {
        throw new ContentValidationError('Colour must be a hex value like #8B1A1A');
      }
      return raw.trim();
    }
    case 'ICON': {
      // lucide-react exports PascalCase names; anything else would fail to
      // resolve on the client and render nothing.
      if (typeof raw !== 'string' || !/^[A-Z][A-Za-z0-9]{0,48}$/.test(raw)) {
        throw new ContentValidationError('Icon must be a valid icon name');
      }
      return raw;
    }
    case 'IMAGE': {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new ContentValidationError('Image must be an object');
      }
      const img = raw as Record<string, unknown>;
      if (!isSafeUrl(img.url)) throw new ContentValidationError('Image URL is not valid');
      return {
        url: String(img.url).trim(),
        alt: typeof img.alt === 'string' ? stripTags(img.alt).slice(0, 300) : '',
        publicId: typeof img.publicId === 'string' ? img.publicId.slice(0, 300) : null,
        width: Number.isFinite(Number(img.width)) ? Number(img.width) : null,
        height: Number.isFinite(Number(img.height)) ? Number(img.height) : null,
      };
    }
    case 'LINK': {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new ContentValidationError('Link must be an object');
      }
      const link = raw as Record<string, unknown>;
      if (!isSafeUrl(link.href)) throw new ContentValidationError('Link URL is not valid');
      return {
        href: String(link.href).trim(),
        label: typeof link.label === 'string' ? stripTags(link.label).slice(0, 300) : '',
        external: Boolean(link.external),
      };
    }
    case 'JSON': {
      if (raw === null || typeof raw !== 'object') {
        throw new ContentValidationError('Collection content must be an object or array');
      }
      if (countNodes(raw) > MAX_JSON_NODES) {
        throw new ContentValidationError('Collection is too large');
      }
      return sanitizeDeep(raw as ContentValue);
    }
    default:
      throw new ContentValidationError('Unsupported content type');
  }
};

/** Draft and published diverge exactly while there are unpublished edits. */
export const hasUnpublishedChanges = (draft: unknown, published: unknown): boolean =>
  JSON.stringify(draft ?? null) !== JSON.stringify(published ?? null);
