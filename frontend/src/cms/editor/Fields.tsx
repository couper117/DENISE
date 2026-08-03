import { useMemo, useRef, useState } from 'react';
import { LibraryBig, Loader2, Search, Upload } from 'lucide-react';
import { mediaApi } from '../../lib/api';
import { toast } from '../../components/ui/Toaster';
import { ICON_NAMES, resolveIcon } from '../icons';
import MediaLibrary from './MediaLibrary';
import CropTool, { CropButton } from './CropTool';
import type { ContentType, ImageValue, LinkValue } from '../types';

/**
 * The input for one value of one content type. Both the single-value panels and
 * the per-item forms inside the list editor render through here, so a type only
 * ever has one editing UI and the two cannot drift apart.
 */

export const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="cms-label">{children}</label>
);

// ─── Text / number / colour ───────────────────────────────────────────────────

export const TextField = ({
  value, onChange, multiline, placeholder, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) =>
  multiline ? (
    <textarea
      className="cms-input"
      rows={4}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <input
      className="cms-input"
      type="text"
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );

export const NumberField = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <input
    className="cms-input"
    type="number"
    value={Number.isFinite(value) ? value : 0}
    onChange={(e) => {
      const n = Number(e.target.value);
      if (Number.isFinite(n)) onChange(n);
    }}
  />
);

export const ColorField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const valid = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        className="cms-color-swatch"
        value={valid ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Pick a colour"
      />
      <input
        className="cms-input font-mono"
        value={value}
        placeholder="#8B1A1A"
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!valid}
      />
    </div>
  );
};

// ─── Link ─────────────────────────────────────────────────────────────────────

const SAFE_URL = /^(https?:\/\/|\/|mailto:|tel:|#)/i;

export const LinkField = ({ value, onChange }: { value: LinkValue; onChange: (v: LinkValue) => void }) => {
  const safe = !value.href || SAFE_URL.test(value.href.trim());
  return (
    <div className="space-y-3">
      <div>
        <Label>Label</Label>
        <TextField value={value.label ?? ''} onChange={(label) => onChange({ ...value, label })} />
      </div>
      <div>
        <Label>Destination</Label>
        <TextField
          value={value.href ?? ''}
          placeholder="/products or https://…"
          onChange={(href) => onChange({ ...value, href })}
        />
        {!safe && (
          <p className="cms-hint text-red-500">
            Must start with http://, https://, /, mailto:, tel: or #
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-[12px] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(value.external)}
          onChange={(e) => onChange({ ...value, external: e.target.checked })}
        />
        Open in a new tab
      </label>
    </div>
  );
};

// ─── Icon ─────────────────────────────────────────────────────────────────────

export const IconField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_NAMES;
    return ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <div className="cms-search">
        <Search size={13} className="opacity-45 shrink-0" />
        <input
          className="cms-search-input"
          value={query}
          placeholder={`Search ${ICON_NAMES.length} icons`}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="cms-icon-grid">
        {matches.map((name) => {
          const Icon = resolveIcon(name);
          if (!Icon) return null;
          return (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={name === value}
              className={`cms-icon-cell ${name === value ? 'is-active' : ''}`}
              onClick={() => onChange(name)}
            >
              <Icon size={17} strokeWidth={1.8} />
            </button>
          );
        })}
        {matches.length === 0 && <p className="cms-hint col-span-full">No icon matches “{query}”.</p>}
      </div>
    </div>
  );
};

// ─── Image ────────────────────────────────────────────────────────────────────

export const ImageField = ({ value, onChange }: { value: ImageValue; onChange: (v: ImageValue) => void }) => {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  // Only set when the current image came from the library, which is what makes
  // the non-destructive server-side crop possible.
  const [assetId, setAssetId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('files', file);
      const res = await mediaApi.upload(form);
      const asset = res.data.data?.[0];
      if (!asset) throw new Error('Upload returned no asset');
      setAssetId(asset.id ?? null);
      onChange({
        url: asset.url,
        alt: value.alt ?? '',
        publicId: asset.publicId ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
      });
      toast({ title: 'Image uploaded', variant: 'success' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upload failed';
      toast({ title: 'Upload failed', description: message, variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={`cms-drop ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
        }}
      >
        {value.url ? (
          <img src={value.url} alt="" className="cms-drop-preview" />
        ) : (
          <p className="cms-hint">No image yet</p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button type="button" className="cms-btn" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
          <button type="button" className="cms-btn" onClick={() => setShowLibrary(true)}>
            <LibraryBig size={13} /> Library
          </button>
          {value.url && <CropButton onClick={() => setShowCrop(true)} />}
        </div>
        <p className="cms-hint">or drop a file here</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>

      {showLibrary && (
        <MediaLibrary
          onClose={() => setShowLibrary(false)}
          onPick={(picked) => {
            // Keep the alt already written for this slot unless the asset has one.
            onChange({ ...picked, alt: picked.alt || value.alt || '' });
            setShowLibrary(false);
          }}
        />
      )}

      {showCrop && (
        <CropTool
          value={value}
          assetId={assetId}
          onClose={() => setShowCrop(false)}
          onApply={(cropped) => {
            onChange(cropped);
            setShowCrop(false);
            toast({ title: 'Crop applied', variant: 'success' });
          }}
        />
      )}

      <div>
        <Label>Image URL</Label>
        <TextField value={value.url ?? ''} onChange={(url) => onChange({ ...value, url })} />
      </div>

      <div>
        <Label>Alt text</Label>
        <TextField
          value={value.alt ?? ''}
          placeholder="Describes the image for screen readers"
          onChange={(alt) => onChange({ ...value, alt })}
        />
        {/* Empty alt is correct for decorative images, so this is a nudge and
            not a validation error. */}
        {!value.alt && <p className="cms-hint">Leave empty only if the image is decorative.</p>}
      </div>
    </div>
  );
};

// ─── Dispatcher ───────────────────────────────────────────────────────────────

interface FieldProps {
  type: ContentType;
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Renders the right input for a content type. Used by the list editor. */
export const Field = ({ type, value, onChange, placeholder, autoFocus }: FieldProps) => {
  switch (type) {
    case 'NUMBER':
      return <NumberField value={Number(value ?? 0)} onChange={onChange} />;
    case 'COLOR':
      return <ColorField value={String(value ?? '')} onChange={onChange} />;
    case 'ICON':
      return <IconField value={String(value ?? '')} onChange={onChange} />;
    case 'IMAGE':
      return <ImageField value={(value as ImageValue) ?? { url: '', alt: '' }} onChange={onChange} />;
    case 'LINK':
      return <LinkField value={(value as LinkValue) ?? { href: '', label: '' }} onChange={onChange} />;
    case 'RICHTEXT':
      return <TextField value={String(value ?? '')} onChange={onChange} multiline placeholder={placeholder} />;
    default:
      return (
        <TextField
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
      );
  }
};
