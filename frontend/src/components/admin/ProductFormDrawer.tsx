import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  X, Ruler, Package, MessageCircle, Plus, Trash2, Star, ImagePlus, Loader2, Info,
  FileText, Tag, Palette, Image as ImageIcon, Eye, ListChecks,
} from 'lucide-react';
import { productsApi } from '../../lib/api';
import { Category, Product, ProductImage } from '../../types';
import { cn } from '../../lib/utils';
import { toast } from '../ui/Toaster';
import ConfirmDialog from './ConfirmDialog';
import {
  COLOUR_PRESETS, HEX_RE, SellMode, flattenCategories, prepareImage, readApiError, sellModeOf,
} from './productAdmin';

// ── Form model ───────────────────────────────────────────────────────────────

type ColourRow = { key: string; name: string; hexCode: string };

type FormState = {
  name: string;
  categoryId: string;
  description: string;
  sellMode: SellMode;
  pricePerMeter: string;
  price: string;
  salePrice: string;
  priceRange: string;
  stockCount: string;
  metersAvailable: string;
  isOnPromotion: boolean;
  promotionText: string;
  colors: ColourRow[];
  isAvailable: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  material: string;
  specifications: string;
};

type FieldKey = keyof FormState | 'images';
type Errors = Partial<Record<FieldKey, string>>;

type PendingImage = { key: string; file: File; url: string };

let seq = 0;
const newKey = () => `k${Date.now().toString(36)}${(seq += 1)}`;

const str = (v: number | string | null | undefined) => (v == null ? '' : String(v));

const toForm = (p: Product | null): FormState => ({
  name: p?.name ?? '',
  categoryId: p?.category?.id ?? '',
  description: p?.description ?? '',
  sellMode: p ? sellModeOf(p) : 'METER',
  pricePerMeter: str(p?.pricePerMeter),
  price: str(p?.price),
  salePrice: str(p?.salePrice),
  priceRange: p?.priceRange ?? '',
  stockCount: str(p?.inventory?.stockCount),
  metersAvailable: str(p?.inventory?.metersAvailable),
  isOnPromotion: p?.isOnPromotion ?? false,
  promotionText: p?.promotionText ?? '',
  colors: (p?.colors ?? []).map((c) => ({ key: newKey(), name: c.name, hexCode: c.hexCode ?? '' })),
  isAvailable: p?.isAvailable ?? true,
  isFeatured: p?.isFeatured ?? false,
  isNewArrival: p?.isNewArrival ?? (p ? false : true),
  material: p?.material ?? '',
  specifications: p?.specifications ?? '',
});

const snapshot = (f: FormState) => JSON.stringify({ ...f, colors: f.colors.map(({ name, hexCode }) => ({ name, hexCode })) });

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

/**
 * The request body. Prices that do not apply to the chosen selling mode are
 * sent as null so the storefront never sees a stale per-metre price on a
 * per-piece product (it gives pricePerMeter priority).
 */
const buildFields = (f: FormState): Record<string, unknown> => {
  const fields: Record<string, unknown> = {
    name: f.name.trim(),
    categoryId: f.categoryId,
    description: f.description.trim(),
    material: f.material.trim(),
    specifications: f.specifications.trim(),
    isAvailable: f.isAvailable,
    isFeatured: f.isFeatured,
    isNewArrival: f.isNewArrival,
    isOnPromotion: f.isOnPromotion,
    promotionText: f.isOnPromotion ? f.promotionText.trim() : '',
    colors: f.colors
      .filter((c) => c.name.trim())
      .map((c) => ({ name: c.name.trim(), ...(HEX_RE.test(c.hexCode) ? { hexCode: c.hexCode.toLowerCase() } : {}) })),
    pricePerMeter: f.sellMode === 'METER' ? numOrNull(f.pricePerMeter) : null,
    price: f.sellMode === 'PIECE' ? numOrNull(f.price) : null,
    salePrice: f.sellMode === 'PIECE' ? numOrNull(f.salePrice) : null,
    priceRange: f.sellMode === 'REQUEST' ? f.priceRange.trim() : '',
    metersAvailable: f.sellMode === 'METER' ? numOrNull(f.metersAvailable) : null,
  };
  if (f.stockCount.trim() !== '') fields.stockCount = Number(f.stockCount);
  return fields;
};

const toFormData = (fields: Record<string, unknown>) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v === null || v === undefined) fd.append(k, '');
    else if (typeof v === 'object') fd.append(k, JSON.stringify(v));
    else fd.append(k, String(v));
  });
  return fd;
};

// ── Small building blocks ────────────────────────────────────────────────────

const inputCls = (error?: string) => cn(
  'w-full rounded-xl border bg-background px-3 py-2.5 text-base sm:text-sm transition-colors',
  'placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30',
  error ? 'border-red-500 dark:border-red-400' : 'border-border',
);

const Field = ({ id, label, hint, error, required, children, className }: {
  id: string; label: string; hint?: string; error?: string; required?: boolean; children: ReactNode; className?: string;
}) => (
  <div className={className} data-field={id}>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
      {label}{required && <span className="text-primary"> *</span>}
    </label>
    {children}
    {error
      ? <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      : hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const Section = ({ id, icon: Icon, title, hint, children }: {
  id: string; icon: typeof Tag; title: string; hint?: string; children: ReactNode;
}) => (
  <section id={id} className="surface scroll-mt-4 p-4 sm:p-5">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon size={16} /></span>
      <div>
        <h3 className="font-semibold leading-8">{title}</h3>
        {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

const Switch = ({ checked, onChange, label, description, id }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description: string; id: string;
}) => (
  <button
    type="button"
    role="switch"
    id={id}
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-accent/50"
  >
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-muted-foreground">{description}</span>
    </span>
    <span className={cn('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted-foreground/30')}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5')} />
    </span>
  </button>
);

// ── Drawer ───────────────────────────────────────────────────────────────────

interface ProductFormDrawerProps {
  /** null = create a new product. */
  product: Product | null;
  categories?: Category[];
  onClose: () => void;
}

const ProductFormDrawer = ({ product, categories, onClose }: ProductFormDrawerProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Becomes the created product if photos fail after a successful create, so a
  // second save updates it instead of creating a duplicate.
  const [current, setCurrent] = useState<Product | null>(product);
  const [form, setForm] = useState<FormState>(() => toForm(product));
  const [initial, setInitial] = useState(() => snapshot(toForm(product)));
  const [errors, setErrors] = useState<Errors>({});
  const [images, setImages] = useState<ProductImage[]>(() => product?.images ?? []);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [pendingMain, setPendingMain] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [confirmRemoveImage, setConfirmRemoveImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const isNew = !current;
  const flatCats = useMemo(() => flattenCategories(categories), [categories]);
  const dirty = snapshot(form) !== initial || pending.length > 0;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Lock page scroll behind the drawer; free object URLs on the way out.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }, [dirty, saving, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDiscard && !confirmRemoveImage) requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose, confirmDiscard, confirmRemoveImage]);

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (f: FormState): Errors => {
    const e: Errors = {};
    const positive = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0;

    if (!f.name.trim()) e.name = t('admin.products.err_name', { defaultValue: 'Give the product a name' });
    else if (f.name.trim().length > 200) e.name = t('admin.products.err_name_long', { defaultValue: 'Keep the name under 200 characters' });
    if (!f.categoryId) e.categoryId = t('admin.products.err_category', { defaultValue: 'Choose where this product appears in the shop' });
    if (f.description.length > 5000) e.description = t('admin.products.err_too_long', { defaultValue: 'This text is too long' });

    if (f.sellMode === 'METER' && !positive(f.pricePerMeter)) {
      e.pricePerMeter = t('admin.products.err_price_meter', { defaultValue: 'Enter the price for one metre' });
    }
    if (f.sellMode === 'PIECE') {
      if (!positive(f.price)) e.price = t('admin.products.err_price_piece', { defaultValue: 'Enter the price for one piece' });
      if (f.salePrice.trim() !== '') {
        if (!positive(f.salePrice)) e.salePrice = t('admin.products.err_price_number', { defaultValue: 'Enter a number greater than 0' });
        else if (positive(f.price) && Number(f.salePrice) >= Number(f.price)) {
          e.salePrice = t('admin.products.err_sale_lower', { defaultValue: 'The sale price must be lower than the normal price' });
        }
      }
    }
    if (f.sellMode === 'METER' && f.metersAvailable.trim() !== '' && !(Number(f.metersAvailable) >= 0)) {
      e.metersAvailable = t('admin.products.err_price_number', { defaultValue: 'Enter a number greater than 0' });
    }
    if (f.stockCount.trim() !== '' && !(Number.isInteger(Number(f.stockCount)) && Number(f.stockCount) >= 0)) {
      e.stockCount = t('admin.products.err_stock', { defaultValue: 'Enter a whole number (0 or more)' });
    }
    if (f.isOnPromotion && !f.promotionText.trim()) {
      e.promotionText = t('admin.products.err_promo', { defaultValue: 'Write the short message customers will see, e.g. "-20% this week"' });
    } else if (f.promotionText.length > 200) {
      e.promotionText = t('admin.products.err_too_long', { defaultValue: 'This text is too long' });
    }
    if (f.colors.some((c) => !c.name.trim())) {
      e.colors = t('admin.products.err_colour_name', { defaultValue: 'Every colour needs a name — or remove the empty one' });
    } else {
      const names = f.colors.map((c) => c.name.trim().toLowerCase());
      if (new Set(names).size !== names.length) e.colors = t('admin.products.err_colour_dup', { defaultValue: 'Two colours have the same name' });
    }
    if (f.material.length > 100) e.material = t('admin.products.err_too_long', { defaultValue: 'This text is too long' });
    if (f.specifications.length > 5000) e.specifications = t('admin.products.err_too_long', { defaultValue: 'This text is too long' });
    return e;
  };

  const showFirstError = (e: Errors) => {
    const first = Object.keys(e)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
    });
  };

  // ── Images ────────────────────────────────────────────────────────────────

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    setPreparing(true);
    const rejected: string[] = [];
    const ready: PendingImage[] = [];
    for (const file of files) {
      const prepared = await prepareImage(file);
      if (prepared) ready.push({ key: newKey(), file: prepared, url: URL.createObjectURL(prepared) });
      else rejected.push(file.name);
    }
    setPreparing(false);
    if (ready.length) {
      setPending((p) => [...p, ...ready]);
      setErrors((er) => ({ ...er, images: undefined }));
    }
    if (rejected.length) {
      const msg = t('admin.products.err_image_unreadable', {
        defaultValue: 'These files could not be used: {{files}}. Choose JPEG, PNG or WebP photos.',
        files: rejected.join(', '),
      });
      setErrors((er) => ({ ...er, images: msg }));
      toast({ variant: 'error', title: t('admin.products.photo_rejected', { defaultValue: 'Some photos were not added' }), description: msg });
    }
  };

  const removePending = (key: string) => {
    setPending((list) => {
      const item = list.find((p) => p.key === key);
      if (item) URL.revokeObjectURL(item.url);
      return list.filter((p) => p.key !== key);
    });
    if (pendingMain === key) setPendingMain(null);
  };

  const makeExistingMain = async (imageId: string) => {
    setImageBusy(imageId);
    try {
      const res = await productsApi.setPrimaryImage(imageId);
      setImages(res.data.data as ProductImage[]);
      setPendingMain(null);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ variant: 'success', title: t('admin.products.main_photo_set', { defaultValue: 'Main photo updated' }) });
    } catch (err) {
      const info = readApiError(err, t('admin.products.main_photo_failed', { defaultValue: 'Could not change the main photo' }));
      toast({ variant: 'error', title: t('admin.products.main_photo_failed', { defaultValue: 'Could not change the main photo' }), description: info.message });
    } finally {
      setImageBusy(null);
    }
  };

  const removeExisting = async (imageId: string) => {
    setImageBusy(imageId);
    try {
      await productsApi.deleteImage(imageId);
      setImages((list) => {
        const removed = list.find((i) => i.id === imageId);
        const rest = list.filter((i) => i.id !== imageId);
        // Mirror the server: when the main photo goes, the next one takes over.
        if (removed?.isPrimary && rest.length && !rest.some((i) => i.isPrimary)) {
          const next = [...rest].sort((a, b) => a.sortOrder - b.sortOrder)[0];
          return rest.map((i) => (i.id === next.id ? { ...i, isPrimary: true } : i));
        }
        return rest;
      });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ variant: 'success', title: t('admin.products.photo_removed', { defaultValue: 'Photo removed' }) });
    } catch (err) {
      const info = readApiError(err, t('admin.products.photo_remove_failed', { defaultValue: 'Could not remove the photo' }));
      toast({ variant: 'error', title: t('admin.products.photo_remove_failed', { defaultValue: 'Could not remove the photo' }), description: info.message });
    } finally {
      setImageBusy(null);
      setConfirmRemoveImage(null);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast({ variant: 'error', title: t('admin.products.fix_fields', { defaultValue: 'Please check the highlighted fields' }) });
      showFirstError(found);
      return;
    }

    setSaving(true);
    const fields = buildFields(form);
    let saved: Product;
    try {
      if (current) {
        const res = await productsApi.update(current.id, fields);
        saved = res.data.data as Product;
      } else {
        const res = await productsApi.create(toFormData(fields));
        saved = res.data.data as Product;
      }
    } catch (err) {
      const info = readApiError(err, t('admin.products.save_failed', { defaultValue: 'The product could not be saved' }));
      const serverErrors: Errors = {};
      Object.entries(info.fieldErrors).forEach(([k, v]) => { if (k in form) serverErrors[k as keyof FormState] = v; });
      setErrors(serverErrors);
      showFirstError(serverErrors);
      toast({ variant: 'error', title: t('admin.products.save_failed', { defaultValue: 'The product could not be saved' }), description: info.message, duration: 7000 });
      setSaving(false);
      return;
    }

    if (pending.length) {
      const hadImages = images.length > 0;
      const existingIds = new Set(images.map((i) => i.id));
      // The chosen main photo goes first: on a product with no photos the
      // server makes the first upload the main one.
      const ordered = pendingMain
        ? [...pending.filter((p) => p.key === pendingMain), ...pending.filter((p) => p.key !== pendingMain)]
        : pending;
      try {
        const fd = new FormData();
        ordered.forEach((p) => fd.append('images', p.file));
        const res = await productsApi.addImages(saved.id, fd);
        let list = (res.data.data as ProductImage[]) ?? [];
        if (pendingMain && hadImages) {
          const firstNew = list.filter((i) => !existingIds.has(i.id)).sort((a, b) => a.sortOrder - b.sortOrder)[0];
          if (firstNew) list = (await productsApi.setPrimaryImage(firstNew.id)).data.data as ProductImage[];
        }
        pending.forEach((p) => URL.revokeObjectURL(p.url));
        setPending([]);
        setPendingMain(null);
        setImages(list);
      } catch (err) {
        // The product itself is saved. Keep the drawer open on it, with the
        // photos still queued, so the admin can simply press save again.
        const info = readApiError(err, t('admin.products.photos_failed', { defaultValue: 'The photos could not be uploaded' }));
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
        setCurrent({ ...saved, images } as Product);
        setInitial(snapshot(form));
        setErrors({ images: info.message });
        showFirstError({ images: info.message });
        toast({
          variant: 'warning',
          title: t('admin.products.saved_but_photos', { defaultValue: 'Product saved, but the photos were not uploaded' }),
          description: info.message,
          duration: 9000,
        });
        setSaving(false);
        return;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
    toast({
      variant: 'success',
      title: isNew
        ? t('admin.products.created_toast', { defaultValue: '“{{name}}” was added to the shop', name: saved.name })
        : t('admin.products.updated_toast', { defaultValue: 'Changes to “{{name}}” were saved', name: saved.name }),
    });
    setSaving(false);
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const sellModes: { value: SellMode; icon: typeof Ruler; title: string; example: string }[] = [
    {
      value: 'METER', icon: Ruler,
      title: t('admin.products.sell_meter', { defaultValue: 'By the metre' }),
      example: t('admin.products.sell_meter_hint', { defaultValue: 'Curtains, fabrics, attire fabric, rods' }),
    },
    {
      value: 'PIECE', icon: Package,
      title: t('admin.products.sell_piece', { defaultValue: 'Per piece' }),
      example: t('admin.products.sell_piece_hint', { defaultValue: 'Ready-made items: cushions, bedding, accessories' }),
    },
    {
      value: 'REQUEST', icon: MessageCircle,
      title: t('admin.products.sell_request', { defaultValue: 'Price on request' }),
      example: t('admin.products.sell_request_hint', { defaultValue: 'You quote each customer after they contact you' }),
    },
  ];

  const sections = [
    { id: 'pf-basics', label: t('admin.products.section_basics', { defaultValue: 'Basics' }) },
    { id: 'pf-selling', label: t('admin.products.section_selling', { defaultValue: 'Selling' }) },
    { id: 'pf-colours', label: t('admin.products.section_colours', { defaultValue: 'Colours' }) },
    { id: 'pf-images', label: t('admin.products.section_images', { defaultValue: 'Photos' }) },
    { id: 'pf-visibility', label: t('admin.products.section_visibility', { defaultValue: 'Visibility' }) },
    { id: 'pf-details', label: t('admin.products.section_details', { defaultValue: 'Details' }) },
  ];

  const presetsLeft = COLOUR_PRESETS.filter((p) => !form.colors.some((c) => c.name.trim().toLowerCase() === p.name.toLowerCase()));
  const noMainYet = !images.some((i) => i.isPrimary);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
      <div className="absolute inset-0 bg-black/50" onClick={requestClose} />

      <div className="relative flex h-full w-full flex-col bg-background shadow-2xl sm:max-w-2xl">
        {/* Header */}
        <div className="border-b border-border bg-card pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{isNew ? t('admin.products.add_new', { defaultValue: 'Add New Product' }) : t('admin.products.edit_title', { defaultValue: 'Edit Product' })}</p>
              <h2 id="product-form-title" className="truncate font-serif text-lg font-semibold">
                {form.name.trim() || t('admin.products.untitled', { defaultValue: 'Untitled product' })}
              </h2>
            </div>
            <button type="button" onClick={requestClose} className="icon-btn" aria-label={t('admin.products.close', { defaultValue: 'Close' })}>
              <X size={20} />
            </button>
          </div>
          {/* Section shortcuts — handy on a phone where the form is long */}
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-6" aria-label={t('admin.products.form_sections', { defaultValue: 'Form sections' })}>
            {sections.map((s) => (
              <button key={s.id} type="button" onClick={() => jumpTo(s.id)}
                className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <form id="product-form" noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4 p-4 sm:p-6">
            {/* Basics */}
            <Section id="pf-basics" icon={FileText} title={t('admin.products.section_basics', { defaultValue: 'Basics' })}>
              <Field id="name" label={t('admin.products.name', { defaultValue: 'Name' })} required error={errors.name}>
                <input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200}
                  placeholder={t('admin.products.name_placeholder', { defaultValue: 'e.g. Velvet night curtain' })}
                  aria-invalid={!!errors.name} className={inputCls(errors.name)} />
              </Field>
              <Field id="categoryId" label={t('admin.products.category', { defaultValue: 'Category' })} required error={errors.categoryId}
                hint={t('admin.products.category_hint', { defaultValue: 'Sub-categories are listed under their main category.' })}>
                <select id="categoryId" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}
                  aria-invalid={!!errors.categoryId} className={inputCls(errors.categoryId)}>
                  <option value="">{t('admin.products.select_category', { defaultValue: 'Select category' })}</option>
                  {flatCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.isChild ? `  — ${c.name}` : c.name}</option>
                  ))}
                </select>
              </Field>
              <Field id="description" label={t('admin.products.description', { defaultValue: 'Description' })} error={errors.description}
                hint={t('admin.products.description_hint', { defaultValue: 'What makes it special: feel, look, where it works best.' })}>
                <textarea id="description" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)}
                  className={cn(inputCls(errors.description), 'resize-y')} />
              </Field>
            </Section>

            {/* Selling */}
            <Section id="pf-selling" icon={Tag} title={t('admin.products.section_selling', { defaultValue: 'Selling' })}
              hint={t('admin.products.section_selling_hint', { defaultValue: 'How customers pay for this product.' })}>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t('admin.products.how_sold', { defaultValue: 'How is it sold?' })}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {sellModes.map(({ value, icon: Icon, title, example }) => {
                    const active = form.sellMode === value;
                    return (
                      <label key={value}
                        className={cn('flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors sm:flex-col sm:gap-1.5',
                          active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-accent/50')}>
                        <input type="radio" name="sellMode" value={value} checked={active} className="sr-only"
                          onChange={() => {
                            set('sellMode', value);
                            setErrors((e) => ({ ...e, price: undefined, salePrice: undefined, pricePerMeter: undefined }));
                          }} />
                        <Icon size={18} className={active ? 'text-primary' : 'text-muted-foreground'} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-muted-foreground">{example}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {form.sellMode === 'METER' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="pricePerMeter" label={t('admin.products.price_per_metre_label', { defaultValue: 'Price for 1 metre (RWF)' })} required error={errors.pricePerMeter}
                    hint={t('admin.products.price_per_metre_hint', { defaultValue: 'The shop works out the total from the size the customer needs.' })}>
                    <input id="pricePerMeter" type="number" inputMode="numeric" min="0" step="1" value={form.pricePerMeter}
                      onChange={(e) => set('pricePerMeter', e.target.value)} placeholder="9800" className={inputCls(errors.pricePerMeter)} />
                  </Field>
                  <Field id="metersAvailable" label={t('admin.products.meters_in_stock', { defaultValue: 'Metres in stock' })} error={errors.metersAvailable}
                    hint={t('admin.products.optional', { defaultValue: 'Optional' })}>
                    <input id="metersAvailable" type="number" inputMode="decimal" min="0" step="0.1" value={form.metersAvailable}
                      onChange={(e) => set('metersAvailable', e.target.value)} className={inputCls(errors.metersAvailable)} />
                  </Field>
                </div>
              )}

              {form.sellMode === 'PIECE' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="price" label={t('admin.products.price_piece_label', { defaultValue: 'Price for 1 piece (RWF)' })} required error={errors.price}>
                    <input id="price" type="number" inputMode="numeric" min="0" step="1" value={form.price}
                      onChange={(e) => set('price', e.target.value)} placeholder="25000" className={inputCls(errors.price)} />
                  </Field>
                  <Field id="salePrice" label={t('admin.products.sale_price_label', { defaultValue: 'Sale price (RWF)' })} error={errors.salePrice}
                    hint={t('admin.products.sale_price_hint', { defaultValue: 'Only when discounted — leave empty otherwise.' })}>
                    <input id="salePrice" type="number" inputMode="numeric" min="0" step="1" value={form.salePrice}
                      onChange={(e) => set('salePrice', e.target.value)} className={inputCls(errors.salePrice)} />
                  </Field>
                </div>
              )}

              {form.sellMode === 'REQUEST' && (
                <Field id="priceRange" label={t('admin.products.price_guide_label', { defaultValue: 'Price guide shown to customers' })} error={errors.priceRange}
                  hint={t('admin.products.price_guide_hint', { defaultValue: 'Optional, e.g. "From 20,000 RWF". Leave empty to show "Price on request".' })}>
                  <input id="priceRange" value={form.priceRange} maxLength={100} onChange={(e) => set('priceRange', e.target.value)}
                    className={inputCls(errors.priceRange)} />
                </Field>
              )}

              {form.sellMode !== 'METER' && (
                <Field id="stockCount" label={t('admin.products.pieces_in_stock', { defaultValue: 'Pieces in stock' })} error={errors.stockCount}
                  hint={t('admin.products.optional', { defaultValue: 'Optional' })} className="sm:max-w-[50%] sm:pr-2">
                  <input id="stockCount" type="number" inputMode="numeric" min="0" step="1" value={form.stockCount}
                    onChange={(e) => set('stockCount', e.target.value)} className={inputCls(errors.stockCount)} />
                </Field>
              )}

              <div data-field="promotionText">
                <Switch id="isOnPromotion" checked={form.isOnPromotion} onChange={(v) => set('isOnPromotion', v)}
                  label={t('admin.products.promotion', { defaultValue: 'Show a promotion badge' })}
                  description={t('admin.products.promotion_hint', { defaultValue: 'A short message on the product, e.g. "-20% this week".' })} />
                {form.isOnPromotion && (
                  <div className="mt-3">
                    <label htmlFor="promotionText" className="sr-only">{t('admin.products.promotion_text', { defaultValue: 'Promotion message' })}</label>
                    <input id="promotionText" value={form.promotionText} maxLength={200} onChange={(e) => set('promotionText', e.target.value)}
                      placeholder={t('admin.products.promotion_placeholder', { defaultValue: '-20% this week' })} className={inputCls(errors.promotionText)} />
                    {errors.promotionText && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.promotionText}</p>}
                  </div>
                )}
              </div>
            </Section>

            {/* Colours */}
            <Section id="pf-colours" icon={Palette} title={t('admin.products.section_colours', { defaultValue: 'Colours' })}
              hint={t('admin.products.section_colours_hint', { defaultValue: 'Customers pick one of these when ordering. Leave empty if there is only one look.' })}>
              <div data-field="colors" className="space-y-2">
                {form.colors.length === 0 && (
                  <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                    {t('admin.products.no_colours', { defaultValue: 'No colours yet.' })}
                  </p>
                )}
                {form.colors.map((c, idx) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border"
                      style={{ background: HEX_RE.test(c.hexCode) ? c.hexCode : undefined }}
                      title={t('admin.products.pick_colour', { defaultValue: 'Pick the colour' })}>
                      {!HEX_RE.test(c.hexCode) && <span className="absolute inset-0 bg-[conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)] opacity-60" />}
                      <input type="color" value={HEX_RE.test(c.hexCode) ? c.hexCode : '#cccccc'}
                        onChange={(e) => set('colors', form.colors.map((x) => (x.key === c.key ? { ...x, hexCode: e.target.value } : x)))}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label={t('admin.products.pick_colour_for', { defaultValue: 'Colour for {{name}}', name: c.name || `#${idx + 1}` })} />
                    </label>
                    <input value={c.name} maxLength={60}
                      onChange={(e) => set('colors', form.colors.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)))}
                      placeholder={t('admin.products.colour_name', { defaultValue: 'Colour name, e.g. Ivory' })}
                      aria-label={t('admin.products.colour_name_label', { defaultValue: 'Colour name' })}
                      className={cn(inputCls(errors.colors && !c.name.trim() ? 'x' : undefined), 'flex-1')} />
                    <span className="hidden w-20 shrink-0 font-mono text-xs uppercase text-muted-foreground sm:block">{c.hexCode || '—'}</span>
                    <button type="button" className="icon-btn shrink-0 hover:text-red-600 dark:hover:text-red-400"
                      onClick={() => set('colors', form.colors.filter((x) => x.key !== c.key))}
                      aria-label={t('admin.products.remove_colour', { defaultValue: 'Remove colour' })}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {errors.colors && <p className="text-xs font-medium text-red-600 dark:text-red-400">{errors.colors}</p>}
              </div>
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => set('colors', [...form.colors, { key: newKey(), name: '', hexCode: '#cccccc' }])}>
                <Plus size={14} /> {t('admin.products.add_colour', { defaultValue: 'Add colour' })}
              </button>
              {presetsLeft.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">{t('admin.products.quick_colours', { defaultValue: 'Quick add:' })}</p>
                  <div className="flex flex-wrap gap-2">
                    {presetsLeft.map((p) => (
                      <button key={p.name} type="button"
                        onClick={() => set('colors', [...form.colors, { key: newKey(), ...p }])}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:border-primary/40">
                        <span className="h-3.5 w-3.5 rounded-full border border-border" style={{ background: p.hexCode }} />
                        {t(`admin.products.colour_${p.name.toLowerCase()}`, { defaultValue: p.name })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Images */}
            <Section id="pf-images" icon={ImageIcon} title={t('admin.products.section_images', { defaultValue: 'Photos' })}
              hint={t('admin.products.section_images_hint', { defaultValue: 'The main photo is the one shown in the shop. New photos upload when you save.' })}>
              <div data-field="images" className="space-y-3">
                {(images.length > 0 || pending.length > 0) && (
                  <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
                    {images.map((img) => {
                      const isMain = img.isPrimary && !pendingMain;
                      const busy = imageBusy === img.id;
                      return (
                        <div key={img.id} className={cn('relative overflow-hidden rounded-xl border bg-muted', isMain ? 'border-primary ring-1 ring-primary' : 'border-border')}>
                          <img src={img.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                          {isMain && (
                            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              <Star size={10} fill="currentColor" /> {t('admin.products.main_photo', { defaultValue: 'Main' })}
                            </span>
                          )}
                          <div className="flex items-center justify-between gap-1 border-t border-border bg-card p-1">
                            {!isMain ? (
                              <button type="button" disabled={!!imageBusy} onClick={() => makeExistingMain(img.id)}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">
                                <Star size={12} /> {t('admin.products.make_main', { defaultValue: 'Make main' })}
                              </button>
                            ) : <span />}
                            <button type="button" disabled={!!imageBusy} onClick={() => setConfirmRemoveImage(img.id)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                              aria-label={t('admin.products.remove_photo', { defaultValue: 'Remove photo' })}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {busy && <div className="absolute inset-0 flex items-center justify-center bg-background/60"><Loader2 className="animate-spin" size={20} /></div>}
                          {confirmRemoveImage === img.id && !busy && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 p-2 text-center">
                              <p className="text-xs font-medium">{t('admin.products.remove_photo_q', { defaultValue: 'Remove this photo?' })}</p>
                              <div className="flex gap-1.5">
                                <button type="button" onClick={() => setConfirmRemoveImage(null)} className="rounded-full border border-border px-2.5 py-1 text-xs">
                                  {t('admin.cancel', { defaultValue: 'Cancel' })}
                                </button>
                                <button type="button" onClick={() => removeExisting(img.id)} className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">
                                  {t('admin.products.remove', { defaultValue: 'Remove' })}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {pending.map((p, i) => {
                      const isMain = pendingMain === p.key || (noMainYet && !pendingMain && i === 0 && images.length === 0);
                      return (
                        <div key={p.key} className={cn('relative overflow-hidden rounded-xl border border-dashed bg-muted', isMain ? 'border-primary ring-1 ring-primary' : 'border-primary/40')}>
                          <img src={p.url} alt="" className="aspect-square w-full object-cover" />
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                            {t('admin.products.not_uploaded', { defaultValue: 'Not saved yet' })}
                          </span>
                          {isMain && (
                            <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              <Star size={10} fill="currentColor" /> {t('admin.products.main_photo', { defaultValue: 'Main' })}
                            </span>
                          )}
                          <div className="flex items-center justify-between gap-1 border-t border-border bg-card p-1">
                            {!isMain ? (
                              <button type="button" onClick={() => setPendingMain(p.key)}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                                <Star size={12} /> {t('admin.products.make_main', { defaultValue: 'Make main' })}
                              </button>
                            ) : <span />}
                            <button type="button" onClick={() => removePending(p.key)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                              aria-label={t('admin.products.remove_photo', { defaultValue: 'Remove photo' })}>
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button type="button" onClick={() => fileRef.current?.click()} disabled={preparing}
                  className={cn('flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors disabled:opacity-60',
                    errors.images ? 'border-red-400 text-red-600 dark:text-red-400' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground')}>
                  {preparing ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
                  <span className="font-medium">
                    {preparing ? t('admin.products.preparing_photos', { defaultValue: 'Preparing photos…' }) : t('admin.products.add_images', { defaultValue: 'Add photos' })}
                  </span>
                  <span className="text-xs">{t('admin.products.upload_hint_auto', { defaultValue: 'From your camera or gallery. Large photos are resized automatically.' })}</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickFiles} className="hidden" />
                {errors.images && <p className="text-xs font-medium text-red-600 dark:text-red-400">{errors.images}</p>}
              </div>
            </Section>

            {/* Visibility */}
            <Section id="pf-visibility" icon={Eye} title={t('admin.products.section_visibility', { defaultValue: 'Visibility' })}>
              <Switch id="isAvailable" checked={form.isAvailable} onChange={(v) => set('isAvailable', v)}
                label={t('admin.products.vis_available', { defaultValue: 'On sale in the shop' })}
                description={t('admin.products.vis_available_hint', { defaultValue: 'Turn off to hide the product without deleting it.' })} />
              <Switch id="isFeatured" checked={form.isFeatured} onChange={(v) => set('isFeatured', v)}
                label={t('admin.products.featured', { defaultValue: 'Featured' })}
                description={t('admin.products.vis_featured_hint', { defaultValue: 'Highlighted on the home page.' })} />
              <Switch id="isNewArrival" checked={form.isNewArrival} onChange={(v) => set('isNewArrival', v)}
                label={t('admin.products.new_arrival', { defaultValue: 'New Arrival' })}
                description={t('admin.products.vis_new_hint', { defaultValue: 'Shown in the “New arrivals” list.' })} />
            </Section>

            {/* Details */}
            <Section id="pf-details" icon={ListChecks} title={t('admin.products.section_details', { defaultValue: 'Details' })}
              hint={t('admin.products.optional', { defaultValue: 'Optional' })}>
              <Field id="material" label={t('admin.products.material', { defaultValue: 'Material' })} error={errors.material}>
                <input id="material" value={form.material} maxLength={100} onChange={(e) => set('material', e.target.value)}
                  placeholder="100% Cotton" className={inputCls(errors.material)} />
              </Field>
              <Field id="specifications" label={t('admin.products.specifications', { defaultValue: 'Specifications' })} error={errors.specifications}
                hint={t('admin.products.specifications_hint', { defaultValue: 'One detail per line, e.g. "Width: 280 cm" or "Washable at 30°C".' })}>
                <textarea id="specifications" rows={4} value={form.specifications} onChange={(e) => set('specifications', e.target.value)}
                  className={cn(inputCls(errors.specifications), 'resize-y')} />
              </Field>
            </Section>

            {!isNew && current && (current._count?.reservationItems ?? 0) > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
                <Info size={14} className="mt-0.5 shrink-0" />
                {t('admin.products.has_orders_note', {
                  defaultValue: 'This product appears in {{count}} order(s). Price changes apply to new orders only.',
                  count: current._count?.reservationItems ?? 0,
                })}
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={requestClose} disabled={saving} className="btn btn-outline">
              {t('admin.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button type="submit" form="product-form" disabled={saving || preparing} className="btn btn-primary flex-1">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving
                ? t('admin.products.saving', { defaultValue: 'Saving...' })
                : isNew ? t('admin.products.create', { defaultValue: 'Create Product' }) : t('admin.products.save', { defaultValue: 'Save changes' })}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        tone="default"
        title={t('admin.products.discard_title', { defaultValue: 'Discard your changes?' })}
        confirmLabel={t('admin.products.discard', { defaultValue: 'Discard' })}
        cancelLabel={t('admin.products.keep_editing', { defaultValue: 'Keep editing' })}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
      >
        {t('admin.products.discard_body', { defaultValue: 'What you typed and any photos not yet saved will be lost.' })}
      </ConfirmDialog>
    </div>
  );
};

export default ProductFormDrawer;
