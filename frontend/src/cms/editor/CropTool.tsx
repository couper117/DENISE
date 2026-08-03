import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Crop as CropIcon, Loader2, X } from 'lucide-react';
import { mediaApi } from '../../lib/api';
import { toast } from '../../components/ui/Toaster';
import { errorMessage } from '../sync';
import type { ImageValue } from '../types';

/**
 * Crop, resize and re-compress an image.
 *
 * Two paths, deliberately:
 *  - With Cloudinary configured the crop is a *delivery transformation*. The
 *    original is untouched, the result is edge-cached, and it can be re-cropped
 *    later from the full-resolution source.
 *  - Otherwise the crop is rasterised on a canvas and uploaded as a new asset,
 *    so this works identically on the local-disk fallback. The original stays
 *    in the library either way.
 */

interface Rect { x: number; y: number; w: number; h: number }

const ASPECTS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 0.8 },
  { label: '3:2', value: 1.5 },
  { label: '16:9', value: 16 / 9 },
];

const MAX_WIDTHS = [800, 1200, 1600, 2400];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface CropToolProps {
  value: ImageValue;
  /** Present when the image is a library asset; enables the server-side path. */
  assetId?: string | null;
  onApply: (value: ImageValue) => void;
  onClose: () => void;
}

const CropTool = ({ value, assetId, onApply, onClose }: CropToolProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }); // fractions
  const [aspect, setAspect] = useState<number | null>(null);
  const [maxWidth, setMaxWidth] = useState(1600);
  const [quality, setQuality] = useState(0.82);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ mode: 'move' | 'draw' | 'resize'; corner?: string; startX: number; startY: number; start: Rect } | null>(null);

  const applyAspect = (r: Rect, a: number | null, boxW: number, boxH: number): Rect => {
    if (!a) return r;
    // Aspect is in image pixels, so convert through the rendered box size.
    const pxW = r.w * boxW;
    const pxH = pxW / a;
    return { ...r, h: clamp(pxH / boxH, 0.02, 1 - r.y) };
  };

  const onPointerDown = (e: React.PointerEvent, mode: 'move' | 'draw' | 'resize', corner?: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { mode, corner, startX: e.clientX, startY: e.clientY, start: rect };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      const box = boxRef.current;
      if (!d || !box) return;
      const b = box.getBoundingClientRect();
      const dx = (e.clientX - d.startX) / b.width;
      const dy = (e.clientY - d.startY) / b.height;

      if (d.mode === 'move') {
        setRect({
          ...d.start,
          x: clamp(d.start.x + dx, 0, 1 - d.start.w),
          y: clamp(d.start.y + dy, 0, 1 - d.start.h),
        });
        return;
      }

      if (d.mode === 'draw') {
        const x0 = clamp((d.startX - b.left) / b.width, 0, 1);
        const y0 = clamp((d.startY - b.top) / b.height, 0, 1);
        const x1 = clamp((e.clientX - b.left) / b.width, 0, 1);
        const y1 = clamp((e.clientY - b.top) / b.height, 0, 1);
        let next: Rect = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
        next = applyAspect(next, aspect, b.width, b.height);
        setRect(next);
        return;
      }

      // resize from a corner
      const s = d.start;
      let next: Rect = { ...s };
      if (d.corner?.includes('e')) next.w = clamp(s.w + dx, 0.02, 1 - s.x);
      if (d.corner?.includes('s')) next.h = clamp(s.h + dy, 0.02, 1 - s.y);
      if (d.corner?.includes('w')) {
        const nx = clamp(s.x + dx, 0, s.x + s.w - 0.02);
        next.w = s.w + (s.x - nx);
        next.x = nx;
      }
      if (d.corner?.includes('n')) {
        const ny = clamp(s.y + dy, 0, s.y + s.h - 0.02);
        next.h = s.h + (s.y - ny);
        next.y = ny;
      }
      setRect(applyAspect(next, aspect, b.width, b.height));
    };

    const onUp = () => { drag.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [aspect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  /** Rasterise the crop locally. Used when there is no server-side transform. */
  const cropOnCanvas = async (): Promise<ImageValue> => {
    const source = new Image();
    // Needed or toBlob throws on a tainted canvas. Unsplash and Cloudinary both
    // send permissive CORS headers; a host that does not will fail here rather
    // than silently produce a broken image.
    source.crossOrigin = 'anonymous';
    source.src = value.url;
    await new Promise((res, rej) => {
      source.onload = res;
      source.onerror = () => rej(new Error('Could not load the image for cropping (blocked by CORS?)'));
    });

    const sx = Math.round(rect.x * source.naturalWidth);
    const sy = Math.round(rect.y * source.naturalHeight);
    const sw = Math.round(rect.w * source.naturalWidth);
    const sh = Math.round(rect.h * source.naturalHeight);

    const scale = Math.min(1, maxWidth / sw);
    const outW = Math.max(1, Math.round(sw * scale));
    const outH = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('Could not encode the cropped image');

    const form = new FormData();
    form.append('files', new File([blob], `crop-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    const res = await mediaApi.upload(form);
    const asset = res.data.data?.[0];
    if (!asset) throw new Error('Upload returned no asset');

    return { url: asset.url, alt: value.alt ?? '', publicId: asset.publicId ?? null, width: outW, height: outH };
  };

  const apply = async () => {
    setBusy(true);
    try {
      if (assetId) {
        const img = imgRef.current;
        const nw = img?.naturalWidth ?? 0;
        const nh = img?.naturalHeight ?? 0;
        const res = await mediaApi.transform(assetId, {
          x: Math.round(rect.x * nw),
          y: Math.round(rect.y * nh),
          width: Math.round(rect.w * nw),
          height: Math.round(rect.h * nh),
          crop: 'crop',
        });
        if (res.data.data?.transformed) {
          onApply({ ...value, url: res.data.data.url });
          return;
        }
      }
      onApply(await cropOnCanvas());
    } catch (e) {
      toast({ title: 'Crop failed', description: errorMessage(e, 'Could not crop the image'), variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const pct = (n: number) => `${n * 100}%`;

  // Portalled for the same reason as MediaLibrary: the parent panel's
  // backdrop-filter would otherwise contain this fixed-position overlay.
  return createPortal(
    <div data-cms-chrome="" className="cms-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cms-modal cms-modal-narrow cms-glass" role="dialog" aria-label="Crop image">
        <div className="cms-panel-head">
          <p className="cms-panel-title">Crop &amp; resize</p>
          <button type="button" className="cms-icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="cms-crop-stage">
          <div ref={boxRef} className="cms-crop-box" onPointerDown={(e) => onPointerDown(e, 'draw')}>
            <img ref={imgRef} src={value.url} alt="" crossOrigin="anonymous" draggable={false} />
            <div className="cms-crop-shade" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 ${pct(rect.y)},${pct(rect.x)} ${pct(rect.y)},${pct(rect.x)} ${pct(rect.y + rect.h)},${pct(rect.x + rect.w)} ${pct(rect.y + rect.h)},${pct(rect.x + rect.w)} ${pct(rect.y)},0 ${pct(rect.y)})` }} />
            <div
              className="cms-crop-rect"
              style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
              onPointerDown={(e) => onPointerDown(e, 'move')}
            >
              {['nw', 'ne', 'sw', 'se'].map((c) => (
                <span key={c} className={`cms-crop-handle is-${c}`} onPointerDown={(e) => onPointerDown(e, 'resize', c)} />
              ))}
            </div>
          </div>
        </div>

        <div className="cms-panel-body cms-crop-controls">
          <div>
            <label className="cms-label">Aspect</label>
            <div className="flex gap-1 flex-wrap">
              {ASPECTS.map((a) => (
                <button key={a.label} type="button"
                  className={`cms-chip ${aspect === a.value ? 'is-active' : ''}`}
                  onClick={() => {
                    setAspect(a.value);
                    const b = boxRef.current?.getBoundingClientRect();
                    if (b) setRect((r) => applyAspect(r, a.value, b.width, b.height));
                  }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="cms-label">Max width</label>
            <div className="flex gap-1 flex-wrap">
              {MAX_WIDTHS.map((w) => (
                <button key={w} type="button" className={`cms-chip ${maxWidth === w ? 'is-active' : ''}`} onClick={() => setMaxWidth(w)}>
                  {w}px
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="cms-label">Quality — {Math.round(quality * 100)}%</label>
            <input type="range" min={40} max={95} value={Math.round(quality * 100)} className="w-full"
              onChange={(e) => setQuality(Number(e.target.value) / 100)} />
          </div>
        </div>

        <div className="cms-panel-foot">
          <button type="button" className="cms-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="cms-btn cms-btn-primary" onClick={apply} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Apply crop
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const CropButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="cms-btn" onClick={onClick}>
    <CropIcon size={13} /> Crop
  </button>
);

export default CropTool;
