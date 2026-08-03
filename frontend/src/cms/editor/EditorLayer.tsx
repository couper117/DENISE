import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import { useCmsStore } from '../store';
import EditorStyles from './EditorStyles';
import EditorToolbar from './EditorToolbar';
import EditorPanel from './EditorPanel';
import { useAnchorRect } from './Panel';
import { useAutosave } from '../useAutosave';

/**
 * Mounted only when an admin turns edit mode on, and reached only through a
 * dynamic import — a visitor never downloads this chunk.
 *
 * Element highlighting is done with delegated listeners and a single floating
 * outline rather than a CSS `:hover` rule, because `:hover` matches every
 * ancestor: a heading inside an editable card would light both up. Reading
 * `closest()` from the event target picks the innermost editable and nothing
 * else.
 */

interface HoverBox {
  key: string;
  type: string;
  rect: DOMRect;
}

const readTarget = (node: EventTarget | null): HTMLElement | null => {
  if (!(node instanceof Element)) return null;
  return node.closest<HTMLElement>('[data-cms-id]');
};

const EditorLayer = () => {
  const selected = useCmsStore((s) => s.selected);
  const select = useCmsStore((s) => s.select);
  // Preview is edit mode with the chrome switched off: drafts still render, but
  // nothing highlights and clicks behave exactly as they will for a visitor.
  const preview = useCmsStore((s) => s.preview);
  const [hover, setHover] = useState<HoverBox | null>(null);
  const rafRef = useRef<number | null>(null);
  const selectedRect = useAnchorRect(selected);

  useAutosave();

  // Hover tracking.
  useEffect(() => {
    const update = (el: HTMLElement | null) => {
      if (!el) {
        setHover(null);
        return;
      }
      const key = el.dataset.cmsId;
      const type = el.dataset.cmsType;
      if (!key || !type) return;
      setHover({ key, type, rect: el.getBoundingClientRect() });
    };

    const onPointerMove = (e: PointerEvent) => {
      // The toolbar and any open panel are chrome, not page content.
      if ((e.target as Element | null)?.closest?.('[data-cms-chrome]')) {
        setHover(null);
        return;
      }
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        update(readTarget(e.target));
      });
    };

    const onLeave = () => setHover(null);

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // The outline is fixed-positioned, so it has to follow scroll and resize.
  useEffect(() => {
    if (!hover) return;
    const reposition = () => {
      const el = document.querySelector<HTMLElement>(`[data-cms-id="${CSS.escape(hover.key)}"]`);
      if (el) setHover((h) => (h ? { ...h, rect: el.getBoundingClientRect() } : h));
    };
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true });
      window.removeEventListener('resize', reposition);
    };
  }, [hover?.key]);

  /**
   * Click opens the editor for the innermost editable. Capture phase, because
   * the page's own handlers — a <Link> to another route, a WhatsApp anchor —
   * would otherwise navigate away mid-edit.
   */
  useEffect(() => {
    if (preview) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-cms-chrome]')) return;
      const el = readTarget(e.target);
      if (!el?.dataset.cmsId) return;
      e.preventDefault();
      e.stopPropagation();
      select(el.dataset.cmsId);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [select, preview]);

  // Escape closes whatever is open; the toolbar owns turning edit mode off.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useCmsStore.getState().selected) {
        e.stopPropagation();
        select(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [select]);

  return createPortal(
    <>
      <EditorStyles />

      {!preview && selectedRect && (
        <div
          data-cms-chrome=""
          className="cms-selected-outline"
          style={{
            top: selectedRect.top - 3,
            left: selectedRect.left - 3,
            width: selectedRect.width + 6,
            height: selectedRect.height + 6,
          }}
        />
      )}

      {!preview && hover && hover.key !== selected && (
        <div
          data-cms-chrome=""
          className="cms-hover-outline"
          style={{
            top: hover.rect.top - 3,
            left: hover.rect.left - 3,
            width: hover.rect.width + 6,
            height: hover.rect.height + 6,
          }}
        >
          <span className="cms-hover-badge">
            <Pencil size={11} strokeWidth={2.4} />
            {hover.key}
          </span>
        </div>
      )}

      <EditorPanel />
      <EditorToolbar />
    </>,
    document.body
  );
};

export default EditorLayer;
