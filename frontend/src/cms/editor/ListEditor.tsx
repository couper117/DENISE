import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Field, Label } from './Fields';
import type { FieldSchema } from '../types';

type Item = Record<string, unknown>;

/** A new entry starts from the shape declared by `fields`, not from nothing. */
const blankItem = (fields: FieldSchema[]): Item => {
  const item: Item = {};
  for (const f of fields) {
    item[f.name] =
      f.type === 'NUMBER' ? 0
      : f.type === 'IMAGE' ? { url: '', alt: '' }
      : f.type === 'LINK' ? { href: '', label: '' }
      : f.type === 'COLOR' ? '#8B1A1A'
      : '';
  }
  return item;
};

/** First text-ish field, used as the row's summary label. */
const summarize = (item: Item, fields: FieldSchema[], index: number): string => {
  const textField = fields.find((f) => f.type === 'TEXT' || f.type === 'RICHTEXT');
  const raw = textField ? item[textField.name] : undefined;
  const text = typeof raw === 'string' ? raw.replace(/<[^>]*>/g, '').trim() : '';
  return text || `Item ${index + 1}`;
};

interface ListEditorProps {
  items: Item[];
  fields: FieldSchema[];
  onChange: (items: Item[]) => void;
}

/**
 * Cards, nav items, footer links, testimonials, pricing tiers. The editor knows
 * nothing about the page — it builds the form from the `fields` schema the
 * EditableList declared, which is what keeps this reusable across every
 * collection on the site without per-page code.
 */
const ListEditor = ({ items, fields, onChange }: ListEditorProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(items.length ? 0 : null);

  const update = (index: number, patch: Item) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setOpenIndex(to);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    setOpenIndex(null);
  };

  const duplicate = (index: number) => {
    const next = [...items];
    next.splice(index + 1, 0, structuredClone(items[index]));
    onChange(next);
    setOpenIndex(index + 1);
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={i} className={`cms-row ${open ? 'is-open' : ''}`}>
            <div className="cms-row-head">
              <button
                type="button"
                className="cms-row-toggle"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
              >
                <span className="cms-row-index">{i + 1}</span>
                <span className="truncate">{summarize(item, fields, i)}</span>
              </button>

              <div className="flex items-center gap-0.5 shrink-0">
                <button type="button" className="cms-icon-btn" onClick={() => move(i, i - 1)}
                  disabled={i === 0} aria-label="Move up" title="Move up">
                  <ChevronUp size={13} />
                </button>
                <button type="button" className="cms-icon-btn" onClick={() => move(i, i + 1)}
                  disabled={i === items.length - 1} aria-label="Move down" title="Move down">
                  <ChevronDown size={13} />
                </button>
                <button type="button" className="cms-icon-btn" onClick={() => duplicate(i)}
                  aria-label="Duplicate" title="Duplicate">
                  <Copy size={13} />
                </button>
                <button type="button" className="cms-icon-btn cms-danger" onClick={() => remove(i)}
                  aria-label="Delete" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {open && (
              <div className="cms-row-body">
                {fields.map((f) => (
                  <div key={f.name}>
                    <Label>{f.label ?? f.name}</Label>
                    <Field
                      type={f.type}
                      value={item[f.name]}
                      placeholder={f.placeholder}
                      onChange={(value) => update(i, { [f.name]: value })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {items.length === 0 && <p className="cms-hint">This collection is empty.</p>}

      <button
        type="button"
        className="cms-btn cms-btn-block"
        onClick={() => {
          onChange([...items, blankItem(fields)]);
          setOpenIndex(items.length);
        }}
      >
        <Plus size={13} /> Add item
      </button>
    </div>
  );
};

export default ListEditor;
