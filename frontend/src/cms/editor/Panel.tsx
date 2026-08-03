import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Tracks the live position of an editable element. The panel is fixed-position,
 * so it has to follow scroll, resize and any layout change the edit itself
 * causes — a heading growing a line moves everything below it.
 */
export const useAnchorRect = (key: string | null): DOMRect | null => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!key) {
      setRect(null);
      return;
    }

    const find = () => document.querySelector<HTMLElement>(`[data-cms-id="${CSS.escape(key)}"]`);
    const measure = () => {
      const el = find();
      setRect(el ? el.getBoundingClientRect() : null);
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);

    // Catches reflow caused by the edit in progress, which no event fires for.
    const el = find();
    const observer = el ? new ResizeObserver(measure) : null;
    if (el && observer) observer.observe(el);

    return () => {
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [key]);

  return rect;
};

const PANEL_WIDTH = 340;
const WIDE_PANEL_WIDTH = 460;
const GAP = 12;

/**
 * Below this the viewport is too narrow for an anchored popover — a 340px panel
 * beside an element leaves nothing readable — so the panel becomes a bottom
 * sheet instead, which is the native pattern on a phone anyway.
 */
export const SHEET_BREAKPOINT = 640;

/** Keeps the panel beside its element and fully on screen. */
const position = (rect: DOMRect | null, height: number, wide: boolean): React.CSSProperties => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Phone: a full-width sheet pinned to the bottom, above the toolbar.
  if (vw < SHEET_BREAKPOINT) {
    return { left: 0, right: 0, bottom: 0, width: '100%', maxHeight: '68vh' };
  }

  const width = wide ? WIDE_PANEL_WIDTH : PANEL_WIDTH;
  if (!rect) return { top: 80, right: 24, width };

  // Prefer below; flip above when there is no room.
  const below = rect.bottom + GAP;
  const top = below + height > vh - 16 ? Math.max(16, rect.top - height - GAP) : below;

  const left = Math.min(Math.max(16, rect.left), vw - width - 16);
  return { top, left, width };
};

interface PanelProps {
  anchorKey: string | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider panels for list and media editors. */
  wide?: boolean;
}

const Panel = ({ anchorKey, title, subtitle, onClose, children, footer, wide }: PanelProps) => {
  const rect = useAnchorRect(anchorKey);
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);
  const [narrow, setNarrow] = useState(() => window.innerWidth < SHEET_BREAKPOINT);

  // Rotating a phone flips between sheet and popover, so this has to react to
  // resize rather than being read once at mount.
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < SHEET_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight);
  }, [children]);

  // Click outside closes. Capture phase so the page's own handlers never see it.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest('[data-cms-chrome]')) return;
      // Clicking another editable switches to it rather than just closing.
      if (target?.closest('[data-cms-id]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  const style = position(rect, height, Boolean(wide));

  return (
    <div
      ref={ref}
      data-cms-chrome=""
      className={`cms-panel cms-glass${narrow ? ' is-sheet' : ''}`}
      style={style}
      role="dialog"
      aria-label={title}
    >
      <div className="cms-panel-head">
        <div className="min-w-0">
          <p className="cms-panel-title">{title}</p>
          {subtitle && <p className="cms-panel-key">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className="cms-icon-btn" aria-label="Close editor">
          <X size={15} />
        </button>
      </div>

      <div className="cms-panel-body">{children}</div>

      {footer && <div className="cms-panel-foot">{footer}</div>}
    </div>
  );
};

export default Panel;
