import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit, Trash2, Eye, Package, X, Upload, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productsApi, categoriesApi } from '../../lib/api';
import { Product, Category } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

type FormState = {
  name: string;
  description: string;
  material: string;
  priceRange: string;
  price: string;
  pricePerMeter: string;
  categoryId: string;
  stockCount: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isAvailable: boolean;
};

const emptyForm: FormState = {
  name: '', description: '', material: '', priceRange: '', price: '', pricePerMeter: '',
  categoryId: '', stockCount: '', isFeatured: false, isNewArrival: false, isAvailable: true,
};

const AdminProducts = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  // editing: null = closed, 'new' = create, Product = edit
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<Product['images']>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', { search, category, page }],
    queryFn: () => productsApi.getAll({ search: search || undefined, category: category || undefined, page, limit: 15 }).then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data.data as Category[]),
  });

  const closeForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setNewImages([]);
    setExistingImages([]);
    setError('');
  };

  const openCreate = () => {
    setForm(emptyForm);
    setNewImages([]);
    setExistingImages([]);
    setError('');
    setEditing('new');
  };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name || '',
      description: p.description || '',
      material: p.material || '',
      priceRange: p.priceRange || '',
      price: p.price != null ? String(p.price) : '',
      pricePerMeter: p.pricePerMeter != null ? String(p.pricePerMeter) : '',
      categoryId: p.category?.id || '',
      stockCount: p.inventory?.stockCount != null ? String(p.inventory.stockCount) : '',
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
      isAvailable: p.isAvailable,
    });
    setNewImages([]);
    setExistingImages(p.images || []);
    setError('');
    setEditing(p);
  };

  // clean up object URLs
  useEffect(() => () => newImages.forEach((f) => URL.revokeObjectURL(URL.createObjectURL(f))), [newImages]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fields: Record<string, string | boolean> = {
        name: form.name,
        description: form.description,
        material: form.material,
        priceRange: form.priceRange,
        price: form.price,
        pricePerMeter: form.pricePerMeter,
        categoryId: form.categoryId,
        stockCount: form.stockCount,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isAvailable: form.isAvailable,
      };

      if (editing === 'new') {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));
        newImages.forEach((file) => fd.append('images', file));
        await productsApi.create(fd);
      } else if (editing) {
        await productsApi.update(editing.id, fields);
        if (newImages.length > 0) {
          const fd = new FormData();
          newImages.forEach((file) => fd.append('images', file));
          await productsApi.addImages(editing.id, fd);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      closeForm();
    },
    onError: () => setError(t('reservation.submit_error')),
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => productsApi.deleteImage(imageId),
    onSuccess: (_res, imageId) => {
      setExistingImages((imgs) => imgs.filter((i) => i.id !== imageId));
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewImages((prev) => [...prev, ...files]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const products: Product[] = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.products.title')}</h1>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={15} /> {t('admin.products.add')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('admin.products.search')}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">{t('admin.products.all_categories')}</option>
          {categories?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {[t('admin.products.col_product'), t('admin.category'), t('admin.products.price_range'), t('admin.products.col_tags'), t('admin.status'), t('admin.actions')].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => {
                  const img = product.images?.find((i) => i.isPrimary) || product.images?.[0];
                  return (
                    <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden shrink-0">
                            {img ? <img src={img.url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">🧵</div>}
                          </div>
                          <span className="font-medium line-clamp-1">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{product.category?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{product.price ? `${product.price.toLocaleString()} RWF` : product.priceRange || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {product.isFeatured && <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded whitespace-nowrap">{t('admin.products.tag_featured')}</span>}
                          {product.isNewArrival && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded whitespace-nowrap">{t('admin.products.tag_new')}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${product.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {product.isAvailable ? t('admin.products.available') : t('admin.products.unavailable')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Link to={`/products/${product.slug}`} target="_blank" className="w-7 h-7 flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                            <Eye size={12} />
                          </Link>
                          <button onClick={() => openEdit(product)}
                            className="w-7 h-7 flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                            <Edit size={12} />
                          </button>
                          <button onClick={() => { if (confirm(t('admin.products.delete_confirm'))) deleteMutation.mutate(product.id); }}
                            disabled={deleteMutation.isPending}
                            className="w-7 h-7 flex items-center justify-center border border-border rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors text-muted-foreground">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {products.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p>{t('admin.products.no_products')}</p>
            </div>
          )}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 border border-border rounded-lg text-sm disabled:opacity-50 hover:bg-accent transition-colors">{t('admin.prev')}</button>
          <span className="px-4 py-2 text-sm">{page} / {pagination.totalPages}</span>
          <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 border border-border rounded-lg text-sm disabled:opacity-50 hover:bg-accent transition-colors">{t('admin.next')}</button>
        </div>
      )}

      {/* ── Create / Edit drawer ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative w-full sm:max-w-lg bg-card h-full overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
              <h3 className="font-semibold">{editing === 'new' ? t('admin.products.add_new') : t('admin.products.edit_title')}</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">{t('admin.products.name')} *</label>
                <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">{t('admin.products.category')} *</label>
                <select required value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">{t('admin.products.select_category')}</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">{t('admin.products.price')}</label>
                  <input type="number" min="0" step="1" inputMode="numeric" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">{t('admin.products.stock')}</label>
                  <input type="number" min="0" step="1" inputMode="numeric" value={form.stockCount} onChange={(e) => setForm((p) => ({ ...p, stockCount: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">{t('admin.products.price_hint')}</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">{t('admin.products.price_per_meter')}</label>
                  <input type="number" min="0" step="1" inputMode="numeric" value={form.pricePerMeter} onChange={(e) => setForm((p) => ({ ...p, pricePerMeter: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">{t('admin.products.price_range')}</label>
                  <input value={form.priceRange} onChange={(e) => setForm((p) => ({ ...p, priceRange: e.target.value }))} placeholder="RWF 5,000 – 15,000/m"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">{t('admin.products.material')}</label>
                <input value={form.material} onChange={(e) => setForm((p) => ({ ...p, material: e.target.value }))} placeholder="100% Cotton"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">{t('admin.products.description')}</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              {/* Images */}
              <div>
                <label className="text-sm font-medium block mb-1">{t('admin.products.images')}</label>

                {existingImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {existingImages.map((img) => (
                      <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        {img.isPrimary && <span className="absolute top-1 left-1 bg-primary text-white rounded-full p-0.5"><Star size={10} /></span>}
                        <button type="button" onClick={() => deleteImageMutation.mutate(img.id)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {newImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {newImages.map((file, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-primary/40">
                        <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setNewImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-1 py-6 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                  <Upload size={20} />
                  <span>{t('admin.products.add_images')}</span>
                  <span className="text-xs">{t('admin.products.upload_hint')}</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickFiles} className="hidden" />
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-4 pt-1">
                {[
                  { field: 'isFeatured', label: t('admin.products.featured') },
                  { field: 'isNewArrival', label: t('admin.products.new_arrival') },
                  { field: 'isAvailable', label: t('admin.products.available_label') },
                ].map(({ field, label }) => (
                  <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form[field as keyof FormState] as boolean}
                      onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.checked }))} className="accent-primary" />
                    {label}
                  </label>
                ))}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-3 pt-2 pb-4">
                <button type="button" onClick={closeForm} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-accent transition-colors">{t('admin.cancel')}</button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="flex-1 px-6 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70">
                  {saveMutation.isPending
                    ? t('admin.products.saving')
                    : editing === 'new' ? t('admin.products.create') : t('admin.products.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
