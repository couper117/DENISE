import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCmsStore } from './store';
import type { ContentType, ContentValue, EditableDescriptor } from './types';

/**
 * Resolution order, and the reason the CMS needed no content migration:
 *
 *   1. the database override for this key, if one exists
 *   2. the bundled i18n string, for text-shaped types
 *   3. the `fallback` prop — whatever was hardcoded before the element became
 *      editable
 *
 * So an empty database renders exactly the site that shipped, and adopting the
 * CMS on an existing element is a one-line change that cannot regress it.
 */
export const useCmsValue = <T extends ContentValue>(
  key: string,
  type: ContentType,
  fallback?: T
): T => {
  const { t } = useTranslation();
  const override = useCmsStore((s) => s.blocks[key]);

  if (override !== undefined && override !== null) return override as T;

  if (type === 'TEXT' || type === 'RICHTEXT') {
    // i18next returns the key itself when there is no translation, which would
    // render "hero.title" on the page. Treat that as "missing".
    const translated = t(key);
    if (translated && translated !== key) return translated as T;
  }

  return fallback as T;
};

/**
 * Announces an element to the editor. Registration is what lets the editor know
 * which editor to open, and what shape a collection has, without any
 * page-specific configuration existing anywhere.
 *
 * Skipped entirely for visitors — nothing is registered and no work is done.
 */
export const useRegisterEditable = (descriptor: EditableDescriptor): void => {
  const canEdit = useCmsStore((s) => s.canEdit);
  const { key, type, label, page, fields, fallback } = descriptor;

  // Serialised so a fresh object literal for `fields`/`fallback` on every render
  // does not re-register on every render.
  const signature = JSON.stringify({ type, label, page, fields });

  useEffect(() => {
    if (!canEdit) return;
    const store = useCmsStore.getState();
    store.register({ key, type, label, page, fields, fallback });
    return () => useCmsStore.getState().unregister(key);
    // `fallback` is intentionally excluded: it is a render-time default, and
    // including it would re-register whenever a parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, key, signature]);
};

/**
 * Whether editing affordances should be live right now.
 *
 * Preview is edit mode with the chrome switched off: drafts still render, but
 * the page behaves exactly as it will for a visitor — no outlines, no data
 * attributes, and links navigate instead of opening an editor.
 */
export const useEditActive = (): boolean =>
  useCmsStore((s) => s.editMode && !s.preview);

/** Props the editor's event delegation looks for. Absent for visitors. */
export const editAttributes = (
  key: string,
  type: ContentType,
  editMode: boolean
): Record<string, string> | undefined =>
  editMode ? { 'data-cms-id': key, 'data-cms-type': type } : undefined;

/** Convenience for components that need to write a value back. */
export const useSetCmsValue = () => useCmsStore((s) => s.setValue);
