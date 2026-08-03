import { create } from 'zustand';
import type {
  BlockMeta,
  ContentType,
  ContentValue,
  EditableDescriptor,
  SaveStatus,
} from './types';

/**
 * Repeat visits hydrate from this synchronously, so overridden content paints
 * correctly on the first frame instead of flashing the bundled default and then
 * swapping. Revalidated against the API immediately afterwards.
 */
const CACHE_KEY = 'denise-cms-content';

interface CachedContent {
  locale: string;
  blocks: Record<string, ContentValue>;
  types: Record<string, ContentType>;
}

const readCache = (locale: string): CachedContent | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${locale}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedContent;
    return parsed.locale === locale ? parsed : null;
  } catch {
    return null;
  }
};

export const writeCache = (data: CachedContent): void => {
  try {
    localStorage.setItem(`${CACHE_KEY}:${data.locale}`, JSON.stringify(data));
  } catch {
    // Quota or private mode — the cache is an optimisation, never a requirement.
  }
};

export const clearCache = (locale: string): void => {
  try {
    localStorage.removeItem(`${CACHE_KEY}:${locale}`);
  } catch {
    /* ignore */
  }
};

interface CmsState {
  /** True only for admins. Gates every editing affordance and the lazy bundle. */
  canEdit: boolean;
  editMode: boolean;
  /** Preview shows drafts laid out exactly as a visitor would see them. */
  preview: boolean;

  locale: string;
  loaded: boolean;

  blocks: Record<string, ContentValue>;
  types: Record<string, ContentType>;
  meta: Record<string, BlockMeta>;

  /** Keys edited since the last save. Drives the autosave batch. */
  dirty: Set<string>;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  saveError: string | null;

  /** Key whose editor is currently open, if any. */
  selected: string | null;

  /** Every Editable currently mounted, keyed by content key. */
  registry: Map<string, EditableDescriptor>;

  setCanEdit: (canEdit: boolean) => void;
  setEditMode: (on: boolean) => void;
  setPreview: (on: boolean) => void;
  setLocale: (locale: string) => void;
  hydrate: (data: {
    locale: string;
    blocks: Record<string, ContentValue>;
    types: Record<string, ContentType>;
    meta?: Record<string, BlockMeta>;
  }) => void;

  setValue: (key: string, type: ContentType, value: ContentValue) => void;
  clearDirty: (keys: string[]) => void;
  setSaveStatus: (status: SaveStatus, detail?: { at?: string; error?: string }) => void;

  select: (key: string | null) => void;
  register: (descriptor: EditableDescriptor) => void;
  unregister: (key: string) => void;
}

export const useCmsStore = create<CmsState>((set) => ({
  canEdit: false,
  editMode: false,
  preview: false,

  locale: 'en',
  loaded: false,

  blocks: {},
  types: {},
  meta: {},

  dirty: new Set<string>(),
  saveStatus: 'idle',
  lastSavedAt: null,
  saveError: null,

  selected: null,
  registry: new Map<string, EditableDescriptor>(),

  setCanEdit: (canEdit) =>
    set((s) => (canEdit ? { canEdit } : { canEdit, editMode: false, preview: false, selected: null })),

  setEditMode: (editMode) => set({ editMode, selected: null, preview: false }),
  setPreview: (preview) => set({ preview, selected: null }),

  setLocale: (locale) => {
    const cached = readCache(locale);
    return set({
      locale,
      loaded: false,
      blocks: cached?.blocks ?? {},
      types: cached?.types ?? {},
      meta: {},
      // Drafts belong to the locale that was open; carrying them across would
      // write one language's edits onto another.
      dirty: new Set<string>(),
      selected: null,
    });
  },

  hydrate: ({ locale, blocks, types, meta }) =>
    set((s) => ({
      locale,
      loaded: true,
      types: { ...s.types, ...types },
      meta: meta ?? s.meta,
      // Unsaved local edits outrank anything just fetched, so a slow response
      // cannot overwrite what the editor typed while it was in flight.
      blocks: s.dirty.size
        ? { ...blocks, ...Object.fromEntries([...s.dirty].map((k) => [k, s.blocks[k]])) }
        : blocks,
    })),

  setValue: (key, type, value) =>
    set((s) => {
      const dirty = new Set(s.dirty);
      dirty.add(key);
      return {
        blocks: { ...s.blocks, [key]: value },
        types: { ...s.types, [key]: type },
        dirty,
        saveStatus: 'idle',
      };
    }),

  clearDirty: (keys) =>
    set((s) => {
      const dirty = new Set(s.dirty);
      for (const k of keys) dirty.delete(k);
      return { dirty };
    }),

  setSaveStatus: (saveStatus, detail) =>
    set({
      saveStatus,
      ...(detail?.at ? { lastSavedAt: detail.at } : {}),
      saveError: detail?.error ?? null,
    }),

  select: (selected) => set({ selected }),

  register: (descriptor) =>
    set((s) => {
      const registry = new Map(s.registry);
      registry.set(descriptor.key, descriptor);
      return { registry };
    }),

  unregister: (key) =>
    set((s) => {
      if (!s.registry.has(key)) return {};
      const registry = new Map(s.registry);
      registry.delete(key);
      return { registry };
    }),
}));

/**
 * Dev-only handle for driving the editor without a backend or an admin session:
 *
 *   __cms.setState({ canEdit: true, editMode: true })
 *
 * Stripped from production builds by the `import.meta.env.DEV` guard, so this
 * is never a way to reach edit mode on the live site. It would not be one
 * anyway — every write is re-checked against `requireAdmin` on the server.
 */
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__cms = useCmsStore;
}

/** Read the initial cache for the detected locale before the first render. */
export const primeFromCache = (locale: string): void => {
  const cached = readCache(locale);
  if (cached) {
    useCmsStore.setState({ locale, blocks: cached.blocks, types: cached.types });
  } else {
    useCmsStore.setState({ locale });
  }
};

/** True when there is anything worth saving or publishing. */
export const selectHasUnsavedChanges = (s: CmsState): boolean => s.dirty.size > 0;
