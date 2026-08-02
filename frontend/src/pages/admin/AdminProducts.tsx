import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit, Trash2, Eye, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productsApi, categoriesApi } from '../../lib/api';
import { Product, Category } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const AdminProducts = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', material: '', priceRange: '', categoryId: '', isFeatured: false, isNewArrival: false, isAvailable: true });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', { search, category, page }],
    queryFn: () => productsApi.getAll({ search: search || undefined, category: category || undefined, page, limit: 15 }).then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data.data as Category[]),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      return productsApi.create(fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setShowForm(false);
      setForm({ name: '', description: '', material: '', priceRange: '', categoryId: '', isFeatured: false, isNewArrival: false, isAvailable: true });
    },
  });

  const products: Product[] = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.products.title')}</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={15} /> {t('admin.products.add')}
        </button>
      </div>

      {/* Quick add form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">{t('admin.products.add_new')}</h3>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">{t('admin.products.name')} *</label>
              <input required value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('admin.products.category')} *</label>
              <select required value={form.categoryId} onChange={(e) => setForm(p => ({ ...p, categoryId: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">{t('admin.products.select_category')}</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('admin.products.price_range')}</label>
              <input value={form.priceRange} onChange={(e) => setForm(p => ({ ...p, priceRange: e.target.value }))} placeholder="e.g. RWF 5,000 – 15,000/m"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t('admin.products.material')}</label>
              <input value={form.material} onChange={(e) => setForm(p => ({ ...p, material: e.target.value }))} placeholder="e.g. 100% Cotton"
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium block mb-1">{t('admin.products.description')}</label>
              <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex gap-4">
              {[
                { field: 'isFeatured', label: t('admin.products.featured') },
                { field: 'isNewArrival', label: t('admin.products.new_arrival') },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form[field as 'isFeatured' | 'isNewArrival']}
                    onChange={(e) => setForm(p => ({ ...p, [field]: e.target.checked }))} className="accent-primary" />
                  {label}
                </label>
              ))}
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-accent transition-colors">{t('admin.cancel')}</button>
              <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70">
                {createMutation.isPending ? t('admin.products.creating') : t('admin.products.create')}
              </button>
            </div>
          </form>
        </div>
      )}

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
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
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
                      <td className="px-4 py-3 text-muted-foreground">{product.category?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{product.priceRange || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {product.isFeatured && <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">{t('admin.products.tag_featured')}</span>}
                          {product.isNewArrival && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">{t('admin.products.tag_new')}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${product.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {product.isAvailable ? t('admin.products.available') : t('admin.products.unavailable')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Link to={`/products/${product.slug}`} target="_blank" className="w-7 h-7 flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                            <Eye size={12} />
                          </Link>
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
    </div>
  );
};

export default AdminProducts;
