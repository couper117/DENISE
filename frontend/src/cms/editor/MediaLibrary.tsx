import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight, FolderPlus, Folder, Image as ImageIcon, Loader2, Pencil,
  Search, Trash2, Upload, X,
} from 'lucide-react';
import { mediaApi } from '../../lib/api';
import { toast } from '../../components/ui/Toaster';
import { errorMessage } from '../sync';
import type { ImageValue } from '../types';

/**
 * The shared media manager. Opened from any image field, so an image uploaded
 * for the hero can be reused in a card without re-uploading it.
 */

export interface MediaAsset {
  id: string;
  url: string;
  publicId: string | null;
  filename: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  tags: string[];
  folderId: string | null;
  createdAt: string;
  uploadedBy?: { firstName: string; lastName: string } | null;
}

interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  _count?: { assets: number; children: number };
}

const humanSize = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB`
  : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB`
  : `${bytes} B`;

interface MediaLibraryProps {
  onPick: (value: ImageValue) => void;
  onClose: () => void;
}

const MediaLibrary = ({ onPick, onClose }: MediaLibraryProps) => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [folderId, setFolderId] = useState<string | 'all' | 'root'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [usage, setUsage] = useState<{ count: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (folderId !== 'all') params.folderId = folderId;
      if (search.trim()) params.search = search.trim();
      const [a, f] = await Promise.all([mediaApi.list(params), mediaApi.listFolders()]);
      setAssets(a.data.data ?? []);
      setFolders(f.data.data ?? []);
    } catch (e) {
      toast({ title: 'Could not load media', description: errorMessage(e, ''), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [folderId, search]);

  // Debounced so typing in the search box is not one request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  // Usage is only needed when something is selected, and only to warn on delete.
  useEffect(() => {
    if (!selected) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    mediaApi
      .usage(selected.id)
      .then((r) => !cancelled && setUsage(r.data.data))
      .catch(() => !cancelled && setUsage(null));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      list.forEach((f) => form.append('files', f));
      if (folderId !== 'all' && folderId !== 'root') form.append('folderId', folderId);
      const res = await mediaApi.upload(form);
      const created: MediaAsset[] = res.data.data ?? [];
      setAssets((prev) => [...created, ...prev]);
      setSelected(created[0] ?? null);
      toast({ title: `${created.length} image${created.length === 1 ? '' : 's'} uploaded`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Upload failed', description: errorMessage(e, 'Could not upload'), variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    try {
      const res = await mediaApi.update(id, data);
      const updated: MediaAsset = res.data.data;
      setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setSelected((s) => (s?.id === id ? updated : s));
    } catch (e) {
      toast({ title: 'Could not update', description: errorMessage(e, ''), variant: 'error' });
    }
  };

  const remove = async (asset: MediaAsset) => {
    // Deleting an image still referenced by a page would blank it, so the count
    // is shown in the prompt rather than discovered afterwards.
    const warning = usage && usage.count > 0
      ? `\n\nIt is used in ${usage.count} place${usage.count === 1 ? '' : 's'}, which will show a broken image.`
      : '';
    if (!window.confirm(`Delete "${asset.filename}"?${warning}`)) return;
    try {
      await mediaApi.remove(asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setSelected(null);
      toast({ title: 'Image deleted' });
    } catch (e) {
      toast({ title: 'Could not delete', description: errorMessage(e, ''), variant: 'error' });
    }
  };

  const newFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    try {
      await mediaApi.createFolder(name.trim(), folderId !== 'all' && folderId !== 'root' ? folderId : null);
      load();
    } catch (e) {
      toast({ title: 'Could not create folder', description: errorMessage(e, ''), variant: 'error' });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // Portalled to <body> because this renders from inside an editor panel, and
  // that panel's `backdrop-filter` makes it a containing block for
  // position:fixed descendants — the modal would be trapped inside the 340px
  // panel instead of covering the viewport.
  return createPortal(
    <div data-cms-chrome="" className="cms-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cms-modal cms-glass" role="dialog" aria-label="Media library">
        <div className="cms-panel-head">
          <div>
            <p className="cms-panel-title">Media library</p>
            <p className="cms-panel-key">{assets.length} image{assets.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" className="cms-icon-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="cms-modal-body">
          {/* Folders */}
          <aside className="cms-media-sidebar">
            <button type="button" className={`cms-folder ${folderId === 'all' ? 'is-active' : ''}`} onClick={() => setFolderId('all')}>
              <ImageIcon size={13} /> All images
            </button>
            <button type="button" className={`cms-folder ${folderId === 'root' ? 'is-active' : ''}`} onClick={() => setFolderId('root')}>
              <Folder size={13} /> Unfiled
            </button>
            {folders.map((f) => (
              <button key={f.id} type="button" className={`cms-folder ${folderId === f.id ? 'is-active' : ''}`} onClick={() => setFolderId(f.id)}>
                <ChevronRight size={12} className="opacity-40" />
                <span className="truncate flex-1 text-left">{f.name}</span>
                <span className="opacity-40 text-[10px]">{f._count?.assets ?? 0}</span>
              </button>
            ))}
            <button type="button" className="cms-folder opacity-70" onClick={newFolder}>
              <FolderPlus size={13} /> New folder
            </button>
          </aside>

          {/* Grid */}
          <div
            className={`cms-media-main ${dragging ? 'is-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files); }}
          >
            <div className="cms-media-toolbar">
              <div className="cms-search flex-1 !mb-0">
                <Search size={13} className="opacity-45 shrink-0" />
                <input className="cms-search-input" value={search} placeholder="Search by name or alt text"
                  onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button type="button" className="cms-btn" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload
              </button>
              <input ref={inputRef} type="file" accept="image/*" multiple hidden
                onChange={(e) => e.target.files && upload(e.target.files)} />
            </div>

            {loading ? (
              <div className="cms-media-empty"><Loader2 size={18} className="animate-spin opacity-50" /></div>
            ) : assets.length === 0 ? (
              <div className="cms-media-empty">
                <p className="cms-hint">No images here yet — drop files anywhere in this panel.</p>
              </div>
            ) : (
              <div className="cms-media-grid">
                {assets.map((a) => (
                  <button key={a.id} type="button"
                    className={`cms-media-cell ${selected?.id === a.id ? 'is-active' : ''}`}
                    onClick={() => setSelected(a)}
                    onDoubleClick={() => onPick({ url: a.url, alt: a.alt ?? '', publicId: a.publicId, width: a.width, height: a.height })}
                    title={a.filename}
                  >
                    <img src={a.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail */}
          {selected && (
            <aside className="cms-media-detail">
              <img src={selected.url} alt="" className="cms-media-preview" />

              <div>
                <label className="cms-label">Filename</label>
                <input className="cms-input" defaultValue={selected.filename}
                  onBlur={(e) => e.target.value !== selected.filename && patch(selected.id, { filename: e.target.value })} />
              </div>

              <div>
                <label className="cms-label">Alt text</label>
                <input className="cms-input" defaultValue={selected.alt ?? ''} placeholder="Describes the image"
                  onBlur={(e) => e.target.value !== (selected.alt ?? '') && patch(selected.id, { alt: e.target.value })} />
              </div>

              <div>
                <label className="cms-label">Tags</label>
                <input className="cms-input" defaultValue={selected.tags.join(', ')} placeholder="hero, fabric"
                  onBlur={(e) => patch(selected.id, { tags: e.target.value })} />
              </div>

              <div>
                <label className="cms-label">Folder</label>
                <select className="cms-input" value={selected.folderId ?? ''}
                  onChange={(e) => patch(selected.id, { folderId: e.target.value || null })}>
                  <option value="">Unfiled</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <p className="cms-hint">
                {selected.width && selected.height ? `${selected.width}×${selected.height} · ` : ''}
                {humanSize(selected.bytes)}
                {usage ? ` · used in ${usage.count} place${usage.count === 1 ? '' : 's'}` : ''}
              </p>

              <div className="flex gap-2 mt-1">
                <button type="button" className="cms-btn flex-1"
                  onClick={() => onPick({ url: selected.url, alt: selected.alt ?? '', publicId: selected.publicId, width: selected.width, height: selected.height })}>
                  <Pencil size={13} /> Use this
                </button>
                <button type="button" className="cms-btn cms-danger" onClick={() => remove(selected)} aria-label="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MediaLibrary;
