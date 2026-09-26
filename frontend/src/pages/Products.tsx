import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, X, ChevronDown, ChevronLeft, ChevronRight, Ruler } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { productsApi, categoriesApi } from '../lib/api';
import { Product, Category } from '../types';
import ProductCard from '../components/products/ProductCard';
import { ProductGridSkeleton } from '../components/ui/SkeletonCard';
import Seo from '../components/Seo';
import Breadcrumbs from '../components/Breadcrumbs';
import { EditableText } from '../cms';
import { categoryLabel } from '../lib/catalog';
import { cn } from '../lib/utils';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'createdAt-desc', key: 'products.sort_newest', label: 'Newest' },
  { value: 'viewCount-desc', key: 'products.sort_popular', label: 'Most popular' },
  { value: 'name-asc', key: 'products.sort_name_asc', label: 'Name A–Z' },
  { value: 'name-desc', key: 'products.sort_name_desc', label: 'Name Z–A' },
];

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
const pageWindow = (current: number, total: number): (number | '…')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
};

/**
 * The URL is the only state: category, search, sort, availability and page all
 * live in the query string, so the header's category bar, the search box, the
 * back button and a shared link all land on exactly the same list.
 */
const Products = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  const category = params.get('category') || '';
  const search = params.get('search') || '';
  const sort = params.get('sort') || 'createdAt-desc';
  const inStock = params.get('availability') === 'true';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const featured = params.get('featured') === 'true';
  const newArrival = params.get('newArrival') === 'true';

  // The search box is typed into locally and written to the URL after a pause.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => { setSearchInput(search); }, [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const id = setTimeout(() => update({ search: searchInput.trim() || null }), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  /** Change some params; any filter change resets to page 1. */
  const update = (changes: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!keepPage) next.delete('page');
    setParams(next, { replace: !('page' in changes) });
    if ('page' in changes) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAll = () => {
    setSearchInput('');
    setParams({});
  };

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data.data as Category[]),
    staleTime: 10 * 60 * 1000,
  });

  const [sortBy, sortOrder] = sort.split('-');
  const queryParams = {
    page,
    limit: PAGE_SIZE,
    sortBy,
    sortOrder,
    category: category || undefined,
    search: search || undefined,
    availability: inStock ? 'true' : undefined,
    isFeatured: featured || undefined,
    isNewArrival: newArrival || undefined,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', queryParams],
    queryFn: () => productsApi.getAll(queryParams as Record<string, unknown>).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const products: Product[] = data?.data || [];
  const pagination = data?.pagination as { total: number; totalPages: number } | undefined;
  const total = pagination?.total ?? 0;

  const allCategories = categories.flatMap((c) => [c, ...(c.children ?? [])]);
  const activeCategory = allCategories.find((c) => c.slug === category);
  const isCurtainList = /curtain|rideau/.test(category) && !/rod/.test(category);

  const title = activeCategory
    ? categoryLabel(activeCategory, t)
    : newArrival
      ? t('home.new_arrivals')
      : featured
        ? t('home.featured')
        : null;

  const chips = [
    activeCategory && { key: 'category', label: categoryLabel(activeCategory, t) },
    search && { key: 'search', label: `“${search}”` },
    inStock && { key: 'availability', label: t('products.in_stock') },
    featured && { key: 'featured', label: t('home.featured') },
    newArrival && { key: 'newArrival', label: t('home.new_arrivals') },
  ].filter(Boolean) as { key: string; label: string }[];

  // ── Filter panel (sidebar on desktop, bottom sheet on phones) ─────────────
  const CategoryLink = ({ c, depth = 0 }: { c: Category; depth?: number }) => (
    <button
      onClick={() => { update({ category: c.slug }); setSheetOpen(false); }}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
        depth > 0 && 'pl-6 text-[13px]',
        category === c.slug ? 'bg-foreground font-medium text-background' : 'text-foreground/80 hover:bg-accent'
      )}
    >
      <span className="truncate">{categoryLabel(c, t)}</span>
    </button>
  );

  const filterPanel = (
    <div className="space-y-7">
      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <EditableText id="products.categories" />
        </p>
        <button
          onClick={() => { update({ category: null }); setSheetOpen(false); }}
          className={cn('flex w-full rounded-lg px-3 py-2 text-left text-sm transition-colors', !category ? 'bg-foreground font-medium text-background' : 'text-foreground/80 hover:bg-accent')}
        >
          <EditableText id="products.all_categories" />
        </button>
        {categories.map((c) => (
          <div key={c.id}>
            <CategoryLink c={c} />
            {c.children?.map((child) => <CategoryLink key={child.id} c={child} depth={1} />)}
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <EditableText id="products.availability" />
        </p>
        <label className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent">
          <EditableText id="products.in_stock" />
          <input type="checkbox" checked={inStock} onChange={(e) => update({ availability: e.target.checked ? 'true' : null })} className="h-4 w-4 accent-[hsl(var(--primary))]" />
        </label>
      </div>
    </div>
  );

  return (
    <div className="shop-container py-6 md:py-10">
      <Seo
        path="/products"
        title="Shop Curtains, Fabrics & Traditional Attire — DENISE Rwanda"
        description="Browse curtains (amarido), voile, blackout & velvet curtains, fabrics, imikenyero, imishanana and imyenda gakondo. Buy online with delivery across Rwanda or reserve for pickup in Kigali."
      />
      <Breadcrumbs items={[{ label: t('nav.products'), to: title ? '/products' : undefined }, ...(title ? [{ label: title }] : [])]} />

      <div className="mb-6 mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          {title ? (
            <h1 className="section-title">{title}</h1>
          ) : (
            <EditableText id="products.title" as="h1" className="section-title" />
          )}
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isLoading ? ' ' : t('products.count', { defaultValue: '{{count}} products', count: total })}
          </p>
        </div>
      </div>

      {/* Curtains: say up front that we do the maths. */}
      {isCurtainList && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
          <Ruler size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{t('curtain.banner_title', { defaultValue: 'Made to measure.' })}</span>{' '}
            {t('curtain.banner_text', { defaultValue: 'Open a curtain, enter your window width and height, and we calculate the metres for the night and day curtains and the rod length.' })}
          </p>
        </div>
      )}

      <div className="flex gap-10">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-40">{filterPanel}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('products.search')}
                aria-label={t('products.search')}
                className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button onClick={() => setSheetOpen(true)} className="btn btn-outline h-11 px-4 lg:hidden">
              <SlidersHorizontal size={15} /> <EditableText id="products.filter" />
              {chips.length > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{chips.length}</span>}
            </button>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => update({ sort: e.target.value === 'createdAt-desc' ? null : e.target.value })}
                aria-label={t('products.sort', { defaultValue: 'Sort' })}
                className="h-11 appearance-none rounded-full border border-input bg-card pl-4 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.key, { defaultValue: o.label })}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Active filters */}
          {chips.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button key={c.key} onClick={() => { if (c.key === 'search') setSearchInput(''); update({ [c.key]: null }); }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  {c.label} <X size={12} />
                </button>
              ))}
              <button onClick={clearAll} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline">
                {t('products.clear_all', { defaultValue: 'Clear all' })}
              </button>
            </div>
          )}

          {/* Grid */}
          {isLoading ? (
            <ProductGridSkeleton count={PAGE_SIZE} />
          ) : products.length > 0 ? (
            <div className={cn('grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4', isFetching && 'opacity-60 transition-opacity')}>
              {products.map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
            </div>
          ) : (
            <div className="surface flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Search size={22} className="text-muted-foreground" /></span>
              <EditableText id="products.no_products" as="h3" className="mt-4 text-lg font-semibold" />
              <p className="mt-1 text-sm text-muted-foreground">{t('products.try_other', { defaultValue: 'Try another search or category.' })}</p>
              <button onClick={clearAll} className="btn btn-dark mt-5">{t('products.clear_all', { defaultValue: 'Clear all' })}</button>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1.5">
              <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)} aria-label={t('common.previous', { defaultValue: 'Previous' })}
                className="icon-btn border border-border disabled:opacity-40"><ChevronLeft size={16} /></button>
              {pageWindow(page, pagination.totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
                ) : (
                  <button key={p} onClick={() => update({ page: p === 1 ? null : String(p) }, true)} aria-current={p === page ? 'page' : undefined}
                    className={cn('h-10 min-w-10 rounded-full px-3 text-sm font-medium', p === page ? 'bg-foreground text-background' : 'hover:bg-accent')}>
                    {p}
                  </button>
                )
              )}
              <button disabled={page >= pagination.totalPages} onClick={() => update({ page: String(page + 1) }, true)} aria-label={t('common.next', { defaultValue: 'Next' })}
                className="icon-btn border border-border disabled:opacity-40"><ChevronRight size={16} /></button>
            </nav>
          )}
        </div>
      </div>

      {/* Filter sheet (phones and tablets) */}
      {createPortal(
        <AnimatePresence>
          {sheetOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/40 lg:hidden" onClick={() => setSheetOpen(false)} />
              <motion.div
                role="dialog" aria-modal="true" aria-label={t('products.filter', { defaultValue: 'Filter' })}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', duration: 0.25 }}
                className="fixed inset-x-0 bottom-0 z-[80] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold"><EditableText id="products.filter" /></h2>
                  <button className="icon-btn" onClick={() => setSheetOpen(false)} aria-label="Close"><X size={20} /></button>
                </div>
                {filterPanel}
                <button onClick={() => setSheetOpen(false)} className="btn btn-dark mt-6 w-full">
                  {t('products.show_results', { defaultValue: 'Show {{count}} products', count: total })}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default Products;
