import { createElement, memo } from 'react';
import { resolveIcon } from './icons';
import { useCmsStore } from './store';
import { editAttributes, useCmsValue, useEditActive, useRegisterEditable } from './useCmsValue';
import type { ContentValue, FieldSchema, ImageValue, LinkValue } from './types';

/**
 * The developer-facing surface of the CMS. Marking something editable is a
 * one-line change that cannot regress the page: the previously hardcoded value
 * becomes the `fallback`, and the database only ever overrides it.
 *
 *   <h1 className="…">{t('hero.title')}</h1>
 *   <EditableText id="hero.title" as="h1" className="…" />
 *
 * For a visitor these render the *same DOM* the hand-written markup did — no
 * wrapper elements, no data attributes, no event listeners. Every editing
 * affordance is gated on edit mode, which only an admin can turn on.
 */

type Tag = keyof JSX.IntrinsicElements;

interface BaseProps {
  /** Content key, e.g. "hero.title". Matches the existing i18n key where one exists. */
  id: string;
  /** Human label shown in the editor's outline panel. */
  label?: string;
  className?: string;
}

// ─── Text ─────────────────────────────────────────────────────────────────────

interface EditableTextProps extends BaseProps {
  as?: Tag;
  fallback?: string;
  /** Multi-line editing (paragraphs) rather than a single-line field. */
  multiline?: boolean;
}

export const EditableText = memo(({ id, as = 'span', label, className, fallback, multiline }: EditableTextProps) => {
  const editMode = useEditActive();
  const value = useCmsValue<string>(id, 'TEXT', fallback ?? '');
  useRegisterEditable({ key: id, type: 'TEXT', label, fallback: fallback ?? '' });

  // Every data attribute must be gated on edit mode, not just the id — a
  // visitor's DOM has to be byte-for-byte what the hand-written markup produced.
  return createElement(
    as,
    {
      className,
      ...editAttributes(id, 'TEXT', editMode),
      ...(editMode && multiline ? { 'data-cms-multiline': 'true' } : {}),
    },
    value
  );
});
EditableText.displayName = 'EditableText';

// ─── Rich text ────────────────────────────────────────────────────────────────

interface EditableRichTextProps extends BaseProps {
  as?: Tag;
  fallback?: string;
}

/**
 * The HTML is sanitised on the server at write time against an allowlist that
 * matches what the toolbar can produce (see backend/src/utils/cms.ts), which is
 * why it can be injected here.
 */
export const EditableRichText = memo(({ id, as = 'div', label, className, fallback }: EditableRichTextProps) => {
  const editMode = useEditActive();
  const value = useCmsValue<string>(id, 'RICHTEXT', fallback ?? '');
  useRegisterEditable({ key: id, type: 'RICHTEXT', label, fallback: fallback ?? '' });

  return createElement(as, {
    className,
    ...editAttributes(id, 'RICHTEXT', editMode),
    dangerouslySetInnerHTML: { __html: value },
  });
});
EditableRichText.displayName = 'EditableRichText';

// ─── Number ───────────────────────────────────────────────────────────────────

interface EditableNumberProps extends BaseProps {
  as?: Tag;
  fallback?: number;
  /** e.g. (n) => n.toLocaleString() or (n) => `${n}+` */
  format?: (value: number) => string;
}

export const EditableNumber = memo(({ id, as = 'span', label, className, fallback, format }: EditableNumberProps) => {
  const editMode = useEditActive();
  const value = useCmsValue<number>(id, 'NUMBER', fallback ?? 0);
  useRegisterEditable({ key: id, type: 'NUMBER', label, fallback: fallback ?? 0 });

  return createElement(
    as,
    { className, ...editAttributes(id, 'NUMBER', editMode) },
    format ? format(value) : String(value)
  );
});
EditableNumber.displayName = 'EditableNumber';

// ─── Image ────────────────────────────────────────────────────────────────────

interface EditableImageProps extends BaseProps {
  fallback: ImageValue;
  /** Applied to the <img>; `className` is applied to the wrapper when present. */
  imgClassName?: string;
  sizes?: string;
  /** Built from the resolved url — lets callers keep responsive srcSets. */
  srcSet?: (url: string) => string | undefined;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}

export const EditableImage = memo(
  ({ id, label, className, fallback, imgClassName, sizes, srcSet, loading = 'lazy', fetchPriority }: EditableImageProps) => {
    const editMode = useEditActive();
    const value = useCmsValue<ImageValue>(id, 'IMAGE', fallback);
    useRegisterEditable({ key: id, type: 'IMAGE', label, fallback: fallback as unknown as ContentValue });

    const img = value ?? fallback;
    const el = (
      <img
        src={img.url}
        srcSet={srcSet?.(img.url)}
        sizes={sizes}
        alt={img.alt ?? ''}
        width={img.width ?? undefined}
        height={img.height ?? undefined}
        className={className && !imgClassName ? className : imgClassName}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        {...editAttributes(id, 'IMAGE', editMode)}
      />
    );

    return el;
  }
);
EditableImage.displayName = 'EditableImage';

// ─── Link ─────────────────────────────────────────────────────────────────────

interface EditableLinkProps extends BaseProps {
  fallback: LinkValue;
  children?: React.ReactNode;
  /** Router navigation for internal hrefs is the caller's concern — see LinkOrAnchor. */
  render?: (value: LinkValue, attrs: Record<string, string> | undefined) => JSX.Element;
}

export const EditableLink = memo(({ id, label, className, fallback, children, render }: EditableLinkProps) => {
  const editMode = useEditActive();
  const value = useCmsValue<LinkValue>(id, 'LINK', fallback);
  useRegisterEditable({ key: id, type: 'LINK', label, fallback: fallback as unknown as ContentValue });

  const link = value ?? fallback;
  const attrs = editAttributes(id, 'LINK', editMode);
  if (render) return render(link, attrs);

  const external = link.external || /^https?:\/\//i.test(link.href);
  return (
    <a
      href={link.href}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...attrs}
    >
      {children ?? link.label}
    </a>
  );
});
EditableLink.displayName = 'EditableLink';

// ─── Icon ─────────────────────────────────────────────────────────────────────

interface EditableIconProps extends BaseProps {
  /** A lucide-react icon name, e.g. "Award". */
  fallback: string;
  size?: number;
  strokeWidth?: number;
}

export const EditableIcon = memo(({ id, label, className, fallback, size = 24, strokeWidth = 1.7 }: EditableIconProps) => {
  const editMode = useEditActive();
  const name = useCmsValue<string>(id, 'ICON', fallback);
  useRegisterEditable({ key: id, type: 'ICON', label, fallback });

  // Falling back on an unknown name matters: an icon removed from the registry
  // would otherwise render nothing and read as a broken page.
  const Icon = resolveIcon(name) ?? resolveIcon(fallback);
  if (!Icon) return null;

  if (!editMode) return <Icon size={size} strokeWidth={strokeWidth} className={className} />;
  return (
    <span data-cms-id={id} data-cms-type="ICON" className="inline-flex">
      <Icon size={size} strokeWidth={strokeWidth} className={className} />
    </span>
  );
});
EditableIcon.displayName = 'EditableIcon';

// ─── Repeatable collections ───────────────────────────────────────────────────

interface EditableListProps<T> extends BaseProps {
  /** The hardcoded array this list replaces. */
  fallback: T[];
  /** Field shapes, so the editor can build a form without knowing the page. */
  fields: FieldSchema[];
  children: (item: T, index: number, all: T[]) => React.ReactNode;
  /** Wrapper element; defaults to a fragment so existing grid markup is untouched. */
  as?: Tag;
}

/**
 * Cards, nav items, footer links, testimonials, pricing tiers — anything the
 * editor can add to, remove from or reorder. The value is a JSON array; `fields`
 * tells the editor how to render a form for one entry.
 */
// `T` is deliberately unconstrained. Requiring `T extends ContentValue` would
// force an index signature onto every page's item interface, which is a tax on
// every caller for no safety the runtime shape check does not already give.
export function EditableList<T>({
  id,
  label,
  className,
  fallback,
  fields,
  children,
  as,
}: EditableListProps<T>) {
  const editMode = useEditActive();
  const value = useCmsValue<ContentValue>(id, 'JSON', fallback as unknown as ContentValue);
  useRegisterEditable({ key: id, type: 'JSON', label, fields, fallback: fallback as unknown as ContentValue });

  // A malformed override must not take the page down.
  const items = (Array.isArray(value) ? value : fallback) as T[];
  const rendered = items.map((item, i) => children(item, i, items));

  if (!as) {
    return editMode ? (
      <div className={className} data-cms-id={id} data-cms-type="JSON">
        {rendered}
      </div>
    ) : (
      <>{rendered}</>
    );
  }

  return createElement(as, { className, ...editAttributes(id, 'JSON', editMode) }, rendered);
}

// ─── Escape hatch ─────────────────────────────────────────────────────────────

/**
 * For content that cannot be expressed by the primitives above — read a raw
 * value and render it however the page needs, while still registering the key
 * so the editor knows about it.
 */
export const useEditableValue = <T extends ContentValue>(
  id: string,
  type: Parameters<typeof useCmsValue>[1],
  fallback: T,
  options?: { label?: string; fields?: FieldSchema[] }
): T => {
  useRegisterEditable({ key: id, type, label: options?.label, fields: options?.fields, fallback });
  return useCmsValue<T>(id, type, fallback);
};
