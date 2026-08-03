import { useEffect, useRef } from 'react';
import { useCmsStore } from './store';
import { saveDrafts } from './sync';

const DEBOUNCE_MS = 1500;
/** Ceiling on how long an edit can sit unsaved while someone keeps typing. */
const MAX_WAIT_MS = 10_000;

/**
 * Autosave. Debounced so a burst of typing is one request, with a hard ceiling
 * so continuous editing still reaches the server — a pure debounce can starve
 * indefinitely, which is exactly when a lost tab hurts most.
 *
 * Mounted by the editor layer, so it exists only while an admin is editing.
 */
export const useAutosave = (): void => {
  const dirtyCount = useCmsStore((s) => s.dirty.size);
  const timerRef = useRef<number | null>(null);
  const firstDirtyAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (dirtyCount === 0) {
      firstDirtyAtRef.current = null;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (firstDirtyAtRef.current === null) firstDirtyAtRef.current = Date.now();

    const waited = Date.now() - firstDirtyAtRef.current;
    const delay = Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - waited));

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      firstDirtyAtRef.current = null;
      // Errors are surfaced through saveStatus; nothing to do here.
      saveDrafts().catch(() => {});
    }, delay);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [dirtyCount]);

  // Last line of defence against closing the tab mid-edit.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useCmsStore.getState().dirty.size === 0) return;
      e.preventDefault();
      // Browsers ignore custom text now, but returnValue is still what triggers
      // the native confirmation dialog.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Flush on unmount — leaving edit mode must not discard a pending save.
  useEffect(
    () => () => {
      if (useCmsStore.getState().dirty.size > 0) saveDrafts().catch(() => {});
    },
    []
  );
};
