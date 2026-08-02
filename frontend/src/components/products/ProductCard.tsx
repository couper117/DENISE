import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ShoppingBag, Share2, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '../../types';
import { useCartStore, useAuthStore } from '../../store';
import { wishlistApi } from '../../lib/api';
import { cn } from '../../lib/utils';

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const { t } = useTranslation();
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);

  const primaryImage = product.images?.find((i) => i.isPrimary) || product.images?.[0];

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product);
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await wishlistApi.remove(product.id);
        setWishlisted(false);
      } else {
        await wishlistApi.add(product.id);
        setWishlisted(true);
      }
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    if (navigator.share) {
      navigator.share({ title: product.name, url: `/products/${product.slug}` });
    } else {
      navigator.clipboard.writeText(window.location.origin + `/products/${product.slug}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link to={`/products/${product.slug}`} className="group block bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        {/* Image */}
        <div className="relative overflow-hidden bg-muted aspect-[4/3]">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <span className="text-4xl">🧵</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.isNewArrival && <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded-full">{t('products.new')}</span>}
            {product.isFeatured && <span className="px-2 py-0.5 bg-primary text-white text-xs font-semibold rounded-full">{t('products.featured')}</span>}
            {product.isOnPromotion && <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-semibold rounded-full">{t('products.promo')}</span>}
            {!product.isAvailable && <span className="px-2 py-0.5 bg-gray-500 text-white text-xs font-semibold rounded-full">{t('products.out_of_stock')}</span>}
          </div>

          {/* Actions overlay */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleWishlist} disabled={wishlistLoading}
              className={cn('w-8 h-8 rounded-full flex items-center justify-center bg-card shadow transition-colors', wishlisted ? 'text-red-500' : 'text-muted-foreground hover:text-red-500')}>
              <Heart size={14} fill={wishlisted ? 'currentColor' : 'none'} />
            </button>
            <button onClick={handleShare} className="w-8 h-8 rounded-full bg-card shadow flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
              <Share2 size={14} />
            </button>
          </div>

          {/* Colors */}
          {product.colors && product.colors.length > 0 && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {product.colors.slice(0, 5).map((c) => (
                <div key={c.id} className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: c.hexCode || '#ccc' }} title={c.name} />
              ))}
              {product.colors.length > 5 && <span className="text-xs text-white bg-black/50 px-1 rounded">+{product.colors.length - 5}</span>}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-1">{product.category?.name}</p>
          <h3 className="font-medium text-sm leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
          {product.material && <p className="text-xs text-muted-foreground mb-2">{product.material}</p>}
          {product.priceRange && <p className="text-sm font-semibold text-primary mb-3">{product.priceRange}</p>}

          <div className="flex gap-2">
            <button onClick={handleAddToCart} disabled={!product.isAvailable}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <ShoppingBag size={13} />
              {t('products.add_to_cart')}
            </button>
            <Link to={`/products/${product.slug}`} className="w-9 h-9 flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
              <Eye size={14} />
            </Link>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
