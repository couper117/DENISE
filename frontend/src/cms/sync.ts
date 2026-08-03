import { cmsApi } from '../lib/api';
import { clearCache, useCmsStore } from './store';
import type { BlockMeta, ContentType, ContentValue } from './types';

/**
 * Every write path to the API. The toolbar and the autosave timer both go
 * through here so there is exactly one implementation of "what does saving
 * mean", and they cannot disagree about it.
 */

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

const messageOf = (e: unknown, fallback: string): string => {
  const err = e as ApiError;
  return err?.response?.data?.message || err?.message || fallback;
};

/** Serialise saves: a slow request must not be overtaken by a later one. */
let inFlight: Promise<void> | null = null;

/**
 * Push every dirty block to the server as one batch.
 *
 * Keys are captured *before* the request and cleared only on success, so edits
 * made while the request is in flight stay dirty and go out with the next save
 * rather than being silently dropped.
 */
export const saveDrafts = async (): Promise<void> => {
  if (inFlight) await inFlight.catch(() => {});

  const state = useCmsStore.getState();
  const keys = [...state.dirty];
  if (!keys.length) return;

  const blocks = keys.map((key) => ({
    key,
    type: (state.types[key] ?? state.registry.get(key)?.type ?? 'TEXT') as ContentType,
    value: state.blocks[key] as ContentValue,
    page: window.location.pathname,
    label: state.registry.get(key)?.label ?? null,
  }));

  state.setSaveStatus('saving');

  inFlight = (async () => {
    try {
      const res = await cmsApi.saveDrafts(state.locale, blocks);
      useCmsStore.getState().clearDirty(keys);
      useCmsStore.getState().setSaveStatus('saved', { at: res.data.data?.savedAt });
    } catch (e) {
      // Keys stay dirty, so the next tick retries them.
      useCmsStore.getState().setSaveStatus('error', { error: messageOf(e, 'Could not save') });
      throw e;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

/** Replace local state with what the server currently holds as the draft. */
export const refreshDraft = async (): Promise<void> => {
  const { locale } = useCmsStore.getState();
  const res = await cmsApi.getDraft(locale);
  const data = res.data.data as {
    blocks: Record<string, ContentValue>;
    types: Record<string, ContentType>;
    meta?: Record<string, BlockMeta>;
  };

  // Drop local edits first: after a discard or restore the server is the truth,
  // and hydrate() deliberately preserves anything still marked dirty.
  useCmsStore.setState({ dirty: new Set<string>() });
  useCmsStore.getState().hydrate({ locale, blocks: data.blocks ?? {}, types: data.types ?? {}, meta: data.meta });
};

/**
 * Publish everything unpublished in this locale. Saves first, because an edit
 * still sitting in the debounce window is not yet a draft on the server and
 * would be left behind.
 */
export const publishAll = async (): Promise<number> => {
  await saveDrafts();
  const { locale } = useCmsStore.getState();
  const res = await cmsApi.publish(locale);

  // The public content endpoint is cached per locale; a publish invalidates it.
  clearCache(locale);
  await refreshDraft();
  return (res.data.data?.published as number) ?? 0;
};

/** Throw away unpublished edits and reload whatever is live. */
export const discardAll = async (): Promise<number> => {
  const { locale } = useCmsStore.getState();
  // Local edits are being thrown away too, so do not push them first.
  useCmsStore.setState({ dirty: new Set<string>() });

  const res = await cmsApi.discard(locale);
  clearCache(locale);
  await refreshDraft();
  useCmsStore.getState().setSaveStatus('idle');
  return (res.data.data?.discarded as number) ?? 0;
};

export const errorMessage = messageOf;
