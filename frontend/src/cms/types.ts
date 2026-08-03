/** Mirrors the ContentType enum in backend/prisma/schema.prisma. */
export type ContentType =
  | 'TEXT'
  | 'RICHTEXT'
  | 'IMAGE'
  | 'LINK'
  | 'ICON'
  | 'NUMBER'
  | 'COLOR'
  | 'JSON';

export interface ImageValue {
  url: string;
  alt?: string;
  publicId?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface LinkValue {
  href: string;
  label?: string;
  external?: boolean;
}

export type ContentValue =
  | string
  | number
  | boolean
  | null
  | ImageValue
  | LinkValue
  | ContentValue[]
  | { [key: string]: ContentValue };

export interface BlockMeta {
  dirty: boolean;
  published: boolean;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Describes a field inside a repeatable collection so the list editor can build
 * a form for it without the CMS knowing anything about the page that uses it.
 */
export interface FieldSchema {
  name: string;
  type: ContentType;
  label?: string;
  /** Shown in the editor when the field is empty. */
  placeholder?: string;
}

/**
 * What an Editable component reports about itself when it mounts. The editor
 * reads the registry to build its outline panel and to know which editor to
 * open for a given key — no page-specific configuration anywhere.
 */
export interface EditableDescriptor {
  key: string;
  type: ContentType;
  label?: string;
  page?: string;
  /** JSON collections only. */
  fields?: FieldSchema[];
  /** The value that renders when the database has no override. */
  fallback?: ContentValue;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
