import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Heart, ShoppingBag } from 'lucide-react';
import { wishlistApi } from '../../lib/api';
import { useCartStore } from '../../store';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const WishlistPage = () => {
  const { t } = useTranslation();
  const { addItem } = useCartStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistApi.getAll().then((r) => r.data.data as Array<{ id: string; product: { id: string; name: string; slug: string; category: { name: string }; images: Array<{ url: string; isPrimary: boolean }> } }>),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => wishlistApi.remove(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="font-serif text-3xl font-bold mb-8">{t('account.wishlist')}</h1>

      {(!data || data.length === 0) ? (
        <div className="text-center py-16">
          <Heart size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-2">Your wishlist is empty</h3>
          <Link to="/products" className="inline-block mt-3 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">Browse Products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.map(({ id, product }) => {
            const img = product.images?.find((i) => i.isPrimary) || product.images?.[0];
            return (
              <div key={id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="aspect-video bg-muted overflow-hidden">
                  {img ? <img src={img.url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🧵</div>}
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{product.category?.name}</p>
                  <h3 className="font-medium text-sm mb-3 line-clamp-2">{product.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => addItem(product as Parameters<typeof addItem>[0])}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors">
                      <ShoppingBag size={12} /> Add to Cart
                    </button>
                    <button onClick={() => removeMutation.mutate(product.id)} disabled={removeMutation.isPending}
                      className="w-8 h-8 flex items-center justify-center border border-border rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors text-muted-foreground">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
