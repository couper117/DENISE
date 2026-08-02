import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { productsApi, categoriesApi } from '../lib/api';
import { Product, Category } from '../types';
import ProductCard from '../components/products/ProductCard';
import { ProductGridSkeleton } from '../components/ui/SkeletonCard';

const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Newest First' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'viewCount-desc', label: 'Most Popular' },
];

const Products = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState(params.get('search') || '');
  const [filters, setFilters] = useState({
    category: params.get('category') || '',
    availability: params.get('availability') || '',
    page: 1,
    limit: 12,
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data.data as Category[]),
  });

  const queryParams = {
    ...filters,
    search: search || undefined,
    isFeatured: params.get('featured') === 'true' ? true : undefined,
    isNewArrival: params.get('newArrival') === 'true' ? true : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['products', queryParams],
    queryFn: () => productsApi.getAll(queryParams as Record<string, unknown>).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const products: Product[] = data?.data || [];
  const pagination = data?.pagination;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const updateFilter = (key: string, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ category: '', availability: '', page: 1, limit: 12, sortBy: 'createdAt', sortOrder: 'desc' });
    setSearch('');
    setParams({});
  };

  const activeFiltersCount = [filters.category, filters.availability, search].filter(Boolean).length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold mb-2">{t('products.title')}</h1>
        <p className="text-muted-foreground">Discover our complete collection of premium textiles</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('products.search')}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => setFilterOpen(!filterOpen)}
          className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-xl text-sm hover:bg-accent transition-colors">
          <SlidersHorizontal size={15} />
          {t('products.filter')}
          {activeFiltersCount > 0 && <span className="bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFiltersCount}</span>}
        </button>

        {/* Sort */}
        <div className="relative">
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              setFilters((prev) => ({ ...prev, sortBy, sortOrder: sortOrder as 'asc' | 'desc' }));
            }}
            className="appearance-none w-full sm:w-44 px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6">
            <div className="bg-card border border-border rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Category */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('products.categories')}</label>
                <div className="space-y-1">
                  <button onClick={() => updateFilter('category', '')}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${!filters.category ? 'bg-primary text-white' : 'hover:bg-accent'}`}>
                    {t('products.all_categories')}
                  </button>
                  {categories?.map((cat) => (
                    <button key={cat.id} onClick={() => updateFilter('category', cat.slug)}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${filters.category === cat.slug ? 'bg-primary text-white' : 'hover:bg-accent'}`}>
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('products.availability')}</label>
                <div className="space-y-1">
                  <button onClick={() => updateFilter('availability', '')}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${!filters.availability ? 'bg-primary text-white' : 'hover:bg-accent'}`}>
                    {t('common.all')}
                  </button>
                  <button onClick={() => updateFilter('availability', 'true')}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${filters.availability === 'true' ? 'bg-primary text-white' : 'hover:bg-accent'}`}>
                    {t('products.in_stock')}
                  </button>
                </div>
              </div>

              {/* Clear */}
              <div className="md:col-span-2 flex items-end">
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors">
                    <X size={14} /> Clear all filters
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category pills */}
      {categories && (
        <div className="flex gap-2 flex-wrap mb-6">
          <button onClick={() => updateFilter('category', '')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${!filters.category ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary hover:text-primary'}`}>
            All
          </button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => updateFilter('category', cat.slug)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filters.category === cat.slug ? 'bg-primary text-white border-primary' : 'border-border hover:border-primary hover:text-primary'}`}>
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      {pagination && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {(filters.page - 1) * filters.limit + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total} products
        </p>
      )}

      {/* Products Grid */}
      {isLoading ? (
        <ProductGridSkeleton count={12} />
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold mb-2">{t('products.no_products')}</h3>
          <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
          <button onClick={clearFilters} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
            Clear Filters
          </button>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <button disabled={filters.page === 1} onClick={() => updateFilter('page', filters.page - 1)}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors disabled:opacity-50">
            Previous
          </button>
          {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
            const page = i + 1;
            return (
              <button key={page} onClick={() => updateFilter('page', page)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${filters.page === page ? 'bg-primary text-white' : 'border border-border hover:bg-accent'}`}>
                {page}
              </button>
            );
          })}
          <button disabled={filters.page === pagination.totalPages} onClick={() => updateFilter('page', filters.page + 1)}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors disabled:opacity-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Products;
