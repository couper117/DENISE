import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, Loader2, RotateCcw, X } from 'lucide-react';
import { cmsApi } from '../../lib/api';
import { toast } from '../../components/ui/Toaster';
import { useCmsStore } from '../store';
import { errorMessage, refreshDraft } from '../sync';
import type { ContentValue } from '../types';

interface Revision {
  id: string;
  value: ContentValue;
  label: string | null;
  createdAt: string;
  author: string;
}

/** Flatten any content value to comparable text so one differ covers all types. */
const asText = (v: ContentValue | undefined): string => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 1);
};

type DiffPart = { text: string; kind: 'same' | 'add' | 'del' };

/**
 * Word-level diff via a longest-common-subsequence table.
 *
 * Deliberately small: content blocks are short, so an O(n·m) table over words is
 * fine and avoids a dependency. Guarded by a size cap because a large JSON
 * collection would otherwise build a very big table.
 */
const diffWords = (before: string, after: string): DiffPart[] => {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);

  if (a.length * b.length > 40_000) {
    return before === after
      ? [{ text: after, kind: 'same' }]
      : [{ text: before, kind: 'del' }, { text: after, kind: 'add' }];
  }

  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (text: string, kind: DiffPart['kind']) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ text, kind });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push(a[i], 'same'); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { push(a[i], 'del'); i++; }
    else { push(b[j], 'add'); j++; }
  }
  while (i < a.length) push(a[i++], 'del');
  while (j < b.length) push(b[j++], 'add');
  return parts;
};

const when = (iso: string): string => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const HistoryPanel = ({ contentKey, onClose }: { contentKey: string; onClose: () => void }) => {
  const locale = useCmsStore((s) => s.locale);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [current, setCurrent] = useState<{ draft: ContentValue; published: ContentValue } | null>(null);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    cmsApi
      .getRevisions(contentKey, locale)
      .then((r) => {
        if (cancelled) return;
        const data = r.data.data;
        setRevisions(data.revisions ?? []);
        setCurrent(data.current ?? null);
        setSelected(data.revisions?.[0] ?? null);
      })
      .catch((e) => toast({ title: 'Could not load history', description: errorMessage(e, ''), variant: 'error' }))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [contentKey, locale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const parts = useMemo(
    () => (selected && current ? diffWords(asText(selected.value), asText(current.draft)) : []),
    [selected, current]
  );

  const restore = async () => {
    if (!selected) return;
    setRestoring(true);
    try {
      await cmsApi.restoreRevision(contentKey, locale, selected.id);
      // Restore lands in the draft, so the editor still has to publish it.
      await refreshDraft();
      toast({ title: 'Version restored', description: 'It is a draft until you publish.', variant: 'success' });
      onClose();
    } catch (e) {
      toast({ title: 'Restore failed', description: errorMessage(e, ''), variant: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  return createPortal(
    <div data-cms-chrome="" className="cms-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cms-modal cms-modal-mid cms-glass" role="dialog" aria-label="Version history">
        <div className="cms-panel-head">
          <div className="min-w-0">
            <p className="cms-panel-title">Version history</p>
            <p className="cms-panel-key">{contentKey}</p>
          </div>
          <button type="button" className="cms-icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="cms-modal-body">
          <aside className="cms-history-list">
            {loading && <div className="p-3"><Loader2 size={15} className="animate-spin opacity-50" /></div>}
            {!loading && revisions.length === 0 && (
              <p className="cms-hint p-3">No published versions yet. History is written each time you publish.</p>
            )}
            {revisions.map((r, i) => (
              <button key={r.id} type="button"
                className={`cms-history-item ${selected?.id === r.id ? 'is-active' : ''}`}
                onClick={() => setSelected(r)}>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[12px]">{i === 0 ? 'Latest published' : `Version ${revisions.length - i}`}</span>
                  <span className="opacity-45 text-[10.5px] shrink-0">{when(r.createdAt)}</span>
                </span>
                <span className="block opacity-60 text-[11px] truncate">{r.author}</span>
                {r.label && <span className="block opacity-45 text-[10.5px] truncate">{r.label}</span>}
              </button>
            ))}
          </aside>

          <div className="cms-history-diff">
            {selected ? (
              <>
                <p className="cms-label">
                  This version <span className="cms-diff-key cms-del">removed</span>{' '}
                  <span className="cms-diff-key cms-add">added</span> compared with the current draft
                </p>
                <div className="cms-diff">
                  {parts.map((p, i) => (
                    <span key={i} className={p.kind === 'add' ? 'cms-add' : p.kind === 'del' ? 'cms-del' : undefined}>
                      {p.text}
                    </span>
                  ))}
                  {parts.length === 0 && <span className="opacity-50">Identical to the current draft.</span>}
                </div>
              </>
            ) : (
              <p className="cms-hint">Select a version to compare it with what is on the page now.</p>
            )}
          </div>
        </div>

        <div className="cms-panel-foot">
          <button type="button" className="cms-btn" onClick={onClose}>Close</button>
          <button type="button" className="cms-btn cms-btn-primary" onClick={restore} disabled={!selected || restoring}>
            {restoring ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Restore this version
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const HistoryButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="cms-btn" onClick={onClick} title="See earlier published versions">
    <History size={13} /> History
  </button>
);

export default HistoryPanel;
