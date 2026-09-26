import type { TFunction } from 'i18next';
import { isAxiosError } from 'axios';
import { Category, Product } from '../../types';

/**
 * How a product is priced. Mirrors the storefront's pricing mode
 * (`pricingMode` in lib/productOptions.ts): a `pricePerMeter` wins, then a
 * piece price, otherwise the shop quotes on request.
 */
export type SellMode = 'METER' | 'PIECE' | 'REQUEST';

export const sellModeOf = (p: Pick<Product, 'pricePerMeter' | 'price' | 'salePrice'>): SellMode => {
  if (p.pricePerMeter != null) return 'METER';
  if (p.price != null || p.salePrice != null) return 'PIECE';
  return 'REQUEST';
};

export const formatRwf = (n: number) => `${Math.round(n).toLocaleString()} RWF`;

/** Short price text for the admin list. */
export const adminPriceLabel = (p: Product, t: TFunction): { main: string; sub?: string; strike?: string } => {
  const mode = sellModeOf(p);
  if (mode === 'METER') {
    return {
      main: t('admin.products.price_per_m_short', { defaultValue: '{{price}} / m', price: formatRwf(p.pricePerMeter!) }),
      sub: t('admin.products.sell_meter', { defaultValue: 'By the metre' }),
    };
  }
  if (mode === 'PIECE') {
    const onSale = p.salePrice != null && p.price != null && p.salePrice < p.price;
    return {
      main: formatRwf((p.salePrice ?? p.price)!),
      strike: onSale ? formatRwf(p.price!) : undefined,
      sub: t('admin.products.sell_piece', { defaultValue: 'Per piece' }),
    };
  }
  return {
    main: p.priceRange || t('admin.products.sell_request', { defaultValue: 'Price on request' }),
    sub: p.priceRange ? t('admin.products.sell_request', { defaultValue: 'Price on request' }) : undefined,
  };
};

/** Flat list of categories for a <select>, sub-categories right after their parent. */
export const flattenCategories = (categories: Category[] | undefined) =>
  (categories ?? []).flatMap((c) => [
    { ...c, isChild: false, parentName: undefined as string | undefined },
    ...(c.children ?? []).map((child) => ({ ...child, isChild: true, parentName: c.name })),
  ]);

/** "Curtains › Soft Curtains" when the product sits in a sub-category. */
export const categoryPath = (product: Product, categories: Category[] | undefined): string => {
  const cat = product.category;
  if (!cat) return '—';
  const parent = categories?.find((c) => c.id === cat.parentId || c.children?.some((ch) => ch.id === cat.id));
  return parent && parent.id !== cat.id ? `${parent.name} › ${cat.name}` : cat.name;
};

export interface ApiErrorInfo {
  message: string;
  code?: string;
  fieldErrors: Record<string, string>;
  status?: number;
}

/** Turn an axios failure into something the admin can read. Never returns an empty message. */
export const readApiError = (err: unknown, fallback: string): ApiErrorInfo => {
  if (isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; code?: string; errors?: { field?: string; message: string }[] }
      | undefined;
    const fieldErrors: Record<string, string> = {};
    data?.errors?.forEach((e) => { if (e.field && !fieldErrors[e.field]) fieldErrors[e.field] = e.message; });
    let message = data?.message || fallback;
    if (message === 'Validation failed' && data?.errors?.length) message = data.errors.map((e) => e.message).join(' · ');
    if (!err.response) message = `${fallback} (network error — check your connection)`;
    return { message, code: data?.code, fieldErrors, status: err.response?.status };
  }
  return { message: err instanceof Error && err.message ? err.message : fallback, fieldErrors: {} };
};

// ── Images ────────────────────────────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_EDGE = 2000;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });

/**
 * Phone photos are often larger than the server's 5 MB limit, and iPhones may
 * hand over HEIC. Anything that is too big or not JPEG/PNG/WebP is redrawn as
 * a JPEG no larger than 2000 px on its longest edge. Returns null when the
 * browser cannot read the file at all.
 */
export const prepareImage = async (file: File): Promise<File | null> => {
  if (ACCEPTED.includes(file.type) && file.size <= MAX_UPLOAD_BYTES) return file;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob || blob.size > MAX_UPLOAD_BYTES) return null;
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  }
};

export const COLOUR_PRESETS: { name: string; hexCode: string }[] = [
  { name: 'White', hexCode: '#ffffff' },
  { name: 'Cream', hexCode: '#f3ead3' },
  { name: 'Beige', hexCode: '#d8c3a5' },
  { name: 'Grey', hexCode: '#8e8e8e' },
  { name: 'Black', hexCode: '#1a1a1a' },
  { name: 'Navy', hexCode: '#1f2a4d' },
  { name: 'Burgundy', hexCode: '#7a1f2b' },
  { name: 'Gold', hexCode: '#c9a13b' },
  { name: 'Green', hexCode: '#2f6b3a' },
  { name: 'Brown', hexCode: '#6b4a2f' },
];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
