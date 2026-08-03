import { useCmsStore } from '../store';
import Panel from './Panel';
import InlineEditor from './InlineEditor';
import ListEditor from './ListEditor';
import { ColorField, IconField, ImageField, LinkField, NumberField } from './Fields';
import type { ContentType, ImageValue, LinkValue } from '../types';

/**
 * Opens the right editor for whatever is selected.
 *
 * Text edits in place on the page; everything else opens an anchored panel,
 * because a colour, an icon or a collection has no sensible inline
 * representation to type into.
 */

const TITLES: Record<ContentType, string> = {
  TEXT: 'Text',
  RICHTEXT: 'Rich text',
  IMAGE: 'Image',
  LINK: 'Link',
  ICON: 'Icon',
  NUMBER: 'Number',
  COLOR: 'Colour',
  JSON: 'Collection',
};

const EditorPanel = () => {
  const selected = useCmsStore((s) => s.selected);
  const select = useCmsStore((s) => s.select);
  const registry = useCmsStore((s) => s.registry);
  const blocks = useCmsStore((s) => s.blocks);
  const setValue = useCmsStore((s) => s.setValue);

  if (!selected) return null;

  const descriptor = registry.get(selected);
  if (!descriptor) return null;

  const { type, label, fields, fallback } = descriptor;
  const close = () => select(null);
  const current = blocks[selected] ?? fallback;
  const commit = (value: unknown) => setValue(selected, type, value as never);

  // Text is edited directly on the page — no panel, no modal, no form.
  if (type === 'TEXT' || type === 'RICHTEXT') {
    const el = document.querySelector<HTMLElement>(`[data-cms-id="${CSS.escape(selected)}"]`);
    return (
      <InlineEditor
        contentKey={selected}
        type={type}
        multiline={el?.dataset.cmsMultiline === 'true'}
        onDone={close}
      />
    );
  }

  const body = () => {
    switch (type) {
      case 'IMAGE':
        return <ImageField value={(current as ImageValue) ?? { url: '', alt: '' }} onChange={commit} />;
      case 'LINK':
        return <LinkField value={(current as LinkValue) ?? { href: '', label: '' }} onChange={commit} />;
      case 'ICON':
        return <IconField value={String(current ?? '')} onChange={commit} />;
      case 'NUMBER':
        return <NumberField value={Number(current ?? 0)} onChange={commit} />;
      case 'COLOR':
        return <ColorField value={String(current ?? '')} onChange={commit} />;
      case 'JSON':
        return (
          <ListEditor
            items={Array.isArray(current) ? (current as Record<string, unknown>[]) : []}
            fields={fields ?? []}
            onChange={commit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Panel
      anchorKey={selected}
      title={label ?? TITLES[type]}
      subtitle={selected}
      onClose={close}
      wide={type === 'JSON' || type === 'IMAGE'}
    >
      {body()}
    </Panel>
  );
};

export default EditorPanel;
