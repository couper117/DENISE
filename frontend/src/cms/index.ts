/**
 * Visual CMS — public surface.
 *
 * Marking something editable is a one-line change:
 *
 *   <h1 className="…">{t('hero.title')}</h1>
 *   <EditableText id="hero.title" as="h1" className="…" />
 *
 * The database only ever *overrides* the value that renders today, so adopting
 * the CMS on an element cannot regress it, and a page written with these
 * components is editable the moment it ships — there is no per-page CMS work.
 */
export { default as CmsProvider, normalizeLocale, SUPPORTED_LOCALES } from './CmsProvider';
export { default as EditWebsiteButton } from './EditWebsiteButton';

export {
  EditableText,
  EditableRichText,
  EditableNumber,
  EditableImage,
  EditableLink,
  EditableIcon,
  EditableList,
  useEditableValue,
} from './Editable';

export { useCmsStore, selectHasUnsavedChanges } from './store';
export { useCmsValue, useRegisterEditable } from './useCmsValue';

export type {
  ContentType,
  ContentValue,
  ImageValue,
  LinkValue,
  FieldSchema,
  EditableDescriptor,
  BlockMeta,
  SaveStatus,
} from './types';
