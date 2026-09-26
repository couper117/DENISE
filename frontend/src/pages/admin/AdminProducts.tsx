import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, ExternalLink, Package, Star, Sparkles, ChevronLeft, ChevronRight, X, EyeOff, Loader2,
} from 'lucide-react';
import { adminApi, categoriesApi, productsApi } from '../../lib/api';
import { Category, PaginationMeta, Product } from '../../types';
import { cn } from '../../lib/utils';
import { toast } from '../../components/ui/Toaster';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import ProductFormDrawer from '../../components/admin/ProductFormDrawer';
import { adminPriceLabel, categoryPath, flattenCategories, readApiError, sellModeOf } from '../../components/admin/productAdmin';

type StatusFilter = '' | 'available' | 'hidden' | 'featured' | 'new';
type ToggleField = 'isAvailable' | 'isFeatured' | 'isNewArrival';
type ListResponse = { data: Product[]; pagination: PaginationMeta };

const PAGE_SIZE = 20;

const AdminProducts = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);

  // null = closed, 'new' = create, Product = edit
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null);

  // Debounce typing so every keystroke doesn't hit the API.
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const queryKey = ['admin-products', { search, category, status, page }];
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => adminApi.getProducts({
      search: search || undefined, category: category || undefined, status: status || undefined, page, limit: PAGE_SIZE,
    }).then((r) => r.data as ListResponse),
    placeholderData: keepPreviousData,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data.data as Category[]),
  });

  const products = data?.data ?? [];
  const pagination = data?.pagination;
  const filtersActive = !!(search || category || status);

  // If deleting the last item on a page leaves it empty, step back a page.
  useEffect(() => {
    if (pagination && page > 1 && page > pagination.totalPages) setPage(Math.max(1, pagination.totalPages));
  }, [pagination, page]);

  // ── Quick toggles (optimistic) ────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: ToggleField; value: boolean }) =>
      productsApi.update(id, { [field]: value }),
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ListResponse>(queryKey);
      queryClient.setQueryData<ListResponse>(queryKey, (old) => old && ({
        ...old, data: old.data.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      }));
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      const info = readApiError(err, t('admin.products.toggle_failed', { defaultValue: 'The change could not be saved' }));
      toast({ variant: 'error', title: t('admin.products.toggle_failed', { defaultValue: 'The change could not be saved' }), description: info.message });
    },
    onSuccess: (_res, { field, value }) => {
      const messages: Record<ToggleField, [string, string]> = {
        isAvailable: [
          t('admin.products.now_on_sale', { defaultValue: 'Now on sale in the shop' }),
          t('admin.products.now_hidden', { defaultValue: 'Hidden from the shop' }),
        ],
        isFeatured: [
          t('admin.products.now_featured', { defaultValue: 'Added to Featured' }),
          t('admin.products.not_featured', { defaultValue: 'Removed from Featured' }),
        ],
        isNewArrival: [
          t('admin.products.now_new', { defaultValue: 'Marked as New arrival' }),
          t('admin.products.not_new', { defaultValue: 'No longer a New arrival' }),
        ],
      };
      toast({ variant: 'success', title: messages[field][value ? 0 : 1], duration: 2500 });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const toggle = (p: Product, field: ToggleField) => toggleMutation.mutate({ id: p.id, field, value: !p[field] });

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      toast({ variant: 'success', title: t('admin.products.deleted_toast', { defaultValue: '“{{name}}” was deleted', name: toDelete?.name }) });
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
    },
    onError: (err) => {
      const info = readApiError(err, t('admin.products.delete_failed', { defaultValue: 'The product could not be deleted' }));
      if (info.code === 'PRODUCT_HAS_ORDERS') {
        setDeleteBlocked(info.message);
        return;
      }
      toast({ variant: 'error', title: t('admin.products.delete_failed', { defaultValue: 'The product could not be deleted' }), description: info.message });
    },
  });

  const closeDelete = () => { setToDelete(null); setDeleteBlocked(null); };

  const hideInstead = () => {
    if (!toDelete) return;
    toggleMutation.mutate({ id: toDelete.id, field: 'isAvailable', value: false });
    closeDelete();
  };

  const clearFilters = () => { setSearchInput(''); setSearch(''); setCategory(''); setStatus(''); setPage(1); };

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: '', label: t('admin.products.filter_all', { defaultValue: 'All' }) },
    { value: 'available', label: t('admin.products.filter_on_sale', { defaultValue: 'On sale' }) },
    { value: 'hidden', label: t('admin.products.filter_hidden', { defaultValue: 'Hidden' }) },
    { value: 'featured', label: t('admin.products.tag_featured', { defaultValue: 'Featured' }) },
    { value: 'new', label: t('admin.products.tag_new', { defaultValue: 'New' }) },
  ];

  const stockLabel = (p: Product) => {
    if (sellModeOf(p) === 'METER') {
      return p.inventory?.metersAvailable != null
        ? t('admin.products.stock_m', { defaultValue: '{{count}} m', count: p.inventory.metersAvailable })
        : '—';
    }
    return p.inventory?.stockCount != null
      ? t('admin.products.stock_pcs', { defaultValue: '{{count}} pcs', count: p.inventory.stockCount })
      : '—';
  };

  // ── Pieces ────────────────────────────────────────────────────────────────
  const thumb = (p: Product, size = 'h-12 w-12') => {
    const img = p.images?.find((i) => i.isPrimary) || p.images?.[0];
    return (
      <div className={cn(size, 'shrink-0 overflow-hidden rounded-lg bg-muted')}>
        {img
          ? <img src={img.url} alt="" className={cn('h-full w-full object-cover', !p.isAvailable && 'opacity-50 grayscale')} loading="lazy" />
          : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package size={18} /></div>}
      </div>
    );
  };

  const price = (p: Product) => {
    const label = adminPriceLabel(p, t);
    return (
      <div className="leading-tight">
        <span className="font-medium">{label.main}</span>
        {label.strike && <span className="ml-1.5 text-xs text-muted-foreground line-through">{label.strike}</span>}
        {label.sub && <span className="block text-xs text-muted-foreground">{label.sub}</span>}
      </div>
    );
  };

  const availabilitySwitch = (p: Product) => (
    <button
      type="button"
      role="switch"
      aria-checked={p.isAvailable}
      onClick={() => toggle(p, 'isAvailable')}
      title={p.isAvailable ? t('admin.products.click_to_hide', { defaultValue: 'Click to hide from the shop' }) : t('admin.products.click_to_show', { defaultValue: 'Click to put on sale' })}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full py-1 text-xs font-medium"
    >
      <span className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', p.isAvailable ? 'bg-green-600 dark:bg-green-500' : 'bg-muted-foreground/30')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', p.isAvailable ? 'translate-x-[1.125rem]' : 'translate-x-0.5')} />
      </span>
      <span className={p.isAvailable ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}>
        {p.isAvailable ? t('admin.products.on_sale', { defaultValue: 'On sale' }) : t('admin.products.hidden', { defaultValue: 'Hidden' })}
      </span>
    </button>
  );

  const flagToggles = (p: Product) => (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => toggle(p, 'isFeatured')} aria-pressed={p.isFeatured}
        title={t('admin.products.toggle_featured', { defaultValue: 'Show on the home page as Featured' })}
        className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
          p.isFeatured
            ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
            : 'border-dashed border-border text-muted-foreground hover:text-foreground')}>
        <Star size={11} fill={p.isFeatured ? 'currentColor' : 'none'} /> {t('admin.products.tag_featured', { defaultValue: 'Featured' })}
      </button>
      <button type="button" onClick={() => toggle(p, 'isNewArrival')} aria-pressed={p.isNewArrival}
        title={t('admin.products.toggle_new', { defaultValue: 'Show in New arrivals' })}
        className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
          p.isNewArrival
            ? 'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300'
            : 'border-dashed border-border text-muted-foreground hover:text-foreground')}>
        <Sparkles size={11} /> {t('admin.products.tag_new', { defaultValue: 'New' })}
      </button>
    </div>
  );

  const actions = (p: Product) => (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setEditing(p)} className="btn btn-outline btn-sm !px-3">
        <Pencil size={13} /> {t('admin.edit', { defaultValue: 'Edit' })}
      </button>
      <Link to={`/products/${p.slug}`} target="_blank" rel="noreferrer" className="icon-btn !h-9 !w-9"
        title={t('admin.products.view_in_shop', { defaultValue: 'View in the shop' })} aria-label={t('admin.products.view_in_shop', { defaultValue: 'View in the shop' })}>
        <ExternalLink size={15} />
      </Link>
      <button type="button" onClick={() => setToDelete(p)} className="icon-btn !h-9 !w-9 hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-500/15 dark:hover:!text-red-400"
        title={t('admin.products.delete', { defaultValue: 'Delete' })} aria-label={t('admin.products.delete', { defaultValue: 'Delete' })}>
        <Trash2 size={15} />
      </button>
    </div>
  );

  const colours = (p: Product) => (p.colors?.length ? (
    <div className="mt-1 flex items-center gap-1">
      {p.colors.slice(0, 6).map((c) => (
        <span key={c.id} title={c.name} className="h-3 w-3 rounded-full border border-border"
          style={{ background: c.hexCode || 'conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)' }} />
      ))}
      {p.colors.length > 6 && <span className="text-[10px] text-muted-foreground">+{p.colors.length - 6}</span>}
    </div>
  ) : null);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{t('admin.products.catalogue', { defaultValue: 'Catalogue' })}</p>
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">{t('admin.products.title', { defaultValue: 'Products' })}</h1>
          {pagination && (
            <p className="text-sm text-muted-foreground">
              {t('admin.products.count', { defaultValue: '{{count}} products', count: pagination.total })}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setEditing('new')} className="btn btn-primary">
          <Plus size={16} /> {t('admin.products.add', { defaultValue: 'Add Product' })}
        </button>
      </div>

      {/* Filters */}
      <div className="surface space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} type="search"
              placeholder={t('admin.products.search', { defaultValue: 'Search products...' })}
              aria-label={t('admin.products.search', { defaultValue: 'Search products...' })}
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-9 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm" />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                aria-label={t('admin.products.clear_search', { defaultValue: 'Clear search' })}>
                <X size={14} />
              </button>
            )}
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            aria-label={t('admin.category', { defaultValue: 'Category' })}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-64 sm:text-sm">
            <option value="">{t('admin.products.all_categories', { defaultValue: 'All Categories' })}</option>
            {flattenCategories(categories).map((c) => (
              <option key={c.id} value={c.slug}>{c.isChild ? `  — ${c.name}` : c.name}</option>
            ))}
          </select>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {statusChips.map((chip) => (
            <button key={chip.value || 'all'} type="button" onClick={() => { setStatus(chip.value); setPage(1); }}
              aria-pressed={status === chip.value}
              className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                status === chip.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}>
              {chip.label}
            </button>
          ))}
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="shrink-0 px-2 text-xs font-medium text-primary hover:underline">
              {t('admin.products.clear_filters', { defaultValue: 'Clear filters' })}
            </button>
          )}
          {isFetching && !isLoading && <Loader2 size={14} className="ml-auto shrink-0 animate-spin self-center text-muted-foreground" />}
        </div>
      </div>

      {isLoading ? (
        <div className="surface divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="skeleton h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/2 rounded" /><div className="skeleton h-3 w-1/4 rounded" /></div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="surface p-8 text-center">
          <p className="font-medium">{t('admin.products.load_failed', { defaultValue: 'The products could not be loaded.' })}</p>
          <button type="button" onClick={() => refetch()} className="btn btn-outline btn-sm mt-3">{t('admin.products.retry', { defaultValue: 'Try again' })}</button>
        </div>
      ) : products.length === 0 ? (
        <div className="surface flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Package size={26} /></span>
          {filtersActive ? (
            <>
              <p className="font-semibold">{t('admin.products.no_match', { defaultValue: 'No products match these filters' })}</p>
              <button type="button" onClick={clearFilters} className="btn btn-outline btn-sm mt-4">{t('admin.products.clear_filters', { defaultValue: 'Clear filters' })}</button>
            </>
          ) : (
            <>
              <p className="font-semibold">{t('admin.products.empty_title', { defaultValue: 'No products yet' })}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {t('admin.products.empty_body', { defaultValue: 'Add your first product with a name, a price and a few photos. You can change everything later.' })}
              </p>
              <button type="button" onClick={() => setEditing('new')} className="btn btn-primary mt-5">
                <Plus size={16} /> {t('admin.products.add', { defaultValue: 'Add Product' })}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="space-y-3 md:hidden">
            {products.map((p) => (
              <li key={p.id} className={cn('surface p-3', !p.isAvailable && 'bg-muted/40')}>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setEditing(p)} className="shrink-0" aria-label={t('admin.edit', { defaultValue: 'Edit' })}>
                    {thumb(p, 'h-16 w-16')}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setEditing(p)} className="block w-full text-left">
                      <span className="line-clamp-2 font-medium leading-snug">{p.name}</span>
                    </button>
                    <p className="truncate text-xs text-muted-foreground">{categoryPath(p, categories)}</p>
                    <div className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                      {price(p)}
                      <span className="shrink-0 text-xs text-muted-foreground">{stockLabel(p)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  {availabilitySwitch(p)}
                  {flagToggles(p)}
                </div>
                <div className="mt-2 flex justify-end">{actions(p)}</div>
              </li>
            ))}
          </ul>

          {/* Tablet / desktop: table */}
          <div className="surface hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    {[
                      t('admin.products.col_product', { defaultValue: 'Product' }),
                      t('admin.category', { defaultValue: 'Category' }),
                      t('admin.products.col_price', { defaultValue: 'Price' }),
                      t('admin.products.col_stock', { defaultValue: 'Stock' }),
                      t('admin.products.col_visibility', { defaultValue: 'In the shop' }),
                      '',
                    ].map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p) => (
                    <tr key={p.id} className={cn('transition-colors hover:bg-muted/30', !p.isAvailable && 'bg-muted/20')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {thumb(p)}
                          <div className="min-w-0">
                            <button type="button" onClick={() => setEditing(p)} className="line-clamp-2 text-left font-medium hover:text-primary">{p.name}</button>
                            {colours(p)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{categoryPath(p, categories)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{price(p)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{stockLabel(p)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          {availabilitySwitch(p)}
                          {flagToggles(p)}
                        </div>
                      </td>
                      <td className="px-4 py-3"><div className="flex justify-end">{actions(p)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <nav className="flex items-center justify-between gap-3" aria-label={t('admin.products.pagination', { defaultValue: 'Pages' })}>
              <p className="text-xs text-muted-foreground">
                {t('admin.products.showing', {
                  defaultValue: 'Showing {{from}}–{{to}} of {{total}}',
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, pagination.total),
                  total: pagination.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-outline btn-sm !px-3">
                  <ChevronLeft size={14} /> <span className="hidden sm:inline">{t('admin.prev', { defaultValue: 'Prev' })}</span>
                </button>
                <span className="text-sm tabular-nums">{page} / {pagination.totalPages}</span>
                <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="btn btn-outline btn-sm !px-3">
                  <span className="hidden sm:inline">{t('admin.next', { defaultValue: 'Next' })}</span> <ChevronRight size={14} />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>

      {editing && (
        <ProductFormDrawer
          key={editing === 'new' ? 'new' : editing.id}
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        busy={deleteMutation.isPending}
        title={deleteBlocked
          ? t('admin.products.cannot_delete_title', { defaultValue: 'This product has orders' })
          : t('admin.products.delete_title', { defaultValue: 'Delete “{{name}}”?', name: toDelete?.name })}
        confirmLabel={deleteBlocked
          ? t('admin.products.hide_instead', { defaultValue: 'Hide from shop' })
          : t('admin.products.delete_forever', { defaultValue: 'Delete product' })}
        cancelLabel={t('admin.cancel', { defaultValue: 'Cancel' })}
        tone={deleteBlocked ? 'default' : 'danger'}
        onCancel={closeDelete}
        onConfirm={() => (deleteBlocked ? hideInstead() : toDelete && deleteMutation.mutate(toDelete.id))}
        extra={!deleteBlocked && toDelete?.isAvailable ? (
          <button type="button" onClick={hideInstead} disabled={deleteMutation.isPending} className="btn btn-outline btn-sm">
            <EyeOff size={14} /> {t('admin.products.hide_instead', { defaultValue: 'Hide from shop' })}
          </button>
        ) : undefined}
      >
        {deleteBlocked
          ? t('admin.products.cannot_delete_body', {
            defaultValue: 'It appears in past orders, so it cannot be deleted without losing order history. You can hide it so customers no longer see it.',
          })
          : t('admin.products.delete_body', {
            defaultValue: 'The product and its photos will be removed permanently. If you only want to stop selling it for now, hide it instead.',
          })}
      </ConfirmDialog>
    </>
  );
};

export default AdminProducts;
