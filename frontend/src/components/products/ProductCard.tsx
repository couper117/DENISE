import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ShoppingBag, Ruler } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '../../types';
import { useCartStore, useAuthStore } from '../../store';
import { wishlistApi } from '../../lib/api';
import { defaultConfiguration, detectKind, validate } from '../../lib/productOptions';
import { categoryLabel, priceLabel } from '../../lib/catalog';
import { toast } from '../ui/Toaster';
import { cn } from '../../lib/utils';

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const { t } = useTranslation();
  const { addLine } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);

  const images = [...(product.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const [primary, secondary] = images;
  const href = `/products/${product.slug}`;

  // A curtain needs measurements and a fabric a length before it can be priced,
  // so those go to the product page. Only a product whose defaults already
  // validate is added straight from the grid.
  const needsConfiguration = Object.keys(validate(product, defaultConfiguration(product))).length > 0;
  const isCurtain = detectKind(product) === 'CURTAIN';
  const actionLabel = needsConfiguration
    ? (isCurtain ? t('products.measure_order', { defaultValue: 'Measure & order' }) : t('products.choose_options', { defaultValue: 'Choose options' }))
    : t('products.add_to_cart');

  const handleAction = (e: React.MouseEvent) => {
    e.preventDefault();
    if (needsConfiguration) {
      navigate(href);
      return;
    }
    addLine(product, defaultConfiguration(product), 1);
    toast({ title: t('cart.added', { defaultValue: 'Added to cart' }), description: product.name, variant: 'success' });
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: href } } });
      return;
    }
    setWishlistLoading(true);
    try {
      if (wishlisted) await wishlistApi.remove(product.id);
      else await wishlistApi.add(product.id);
      setWishlisted((v) => !v);
    } catch { /* leave the heart unchanged */ } finally {
      setWishlistLoading(false);
    }
  };

  const hasDiscount = !!(product.salePrice && product.price && product.salePrice < product.price);
  const badge = !product.isAvailable
    ? { text: t('products.out_of_stock'), cls: 'bg-foreground/80 text-background' }
    : hasDiscount || product.isOnPromotion
      ? { text: product.promotionText || t('products.promo'), cls: 'bg-primary text-primary-foreground' }
      : product.isNewArrival
        ? { text: t('products.new'), cls: 'bg-background text-foreground' }
        : null;
  const ActionIcon = needsConfiguration && isCurtain ? Ruler : ShoppingBag;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.35 }}
      className="h-full"
    >
      <Link to={href} className="group flex h-full flex-col focus-visible:outline-none">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted ring-offset-2 ring-offset-background group-focus-visible:ring-2 group-focus-visible:ring-ring">
          {primary ? (
            <>
              <img
                src={primary.url}
                alt={primary.altText || product.name}
                loading="lazy"
                className={cn('h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.04]', secondary && 'group-hover:opacity-0')}
              />
              {secondary && (
                <img src={secondary.url} alt="" loading="lazy" aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center font-serif text-5xl text-muted-foreground/30">D</div>
          )}

          {badge && (
            <span className={cn('absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm', badge.cls)}>
              {badge.text}
            </span>
          )}

          <button
            onClick={handleWishlist}
            disabled={wishlistLoading}
            aria-label={t('products.save', { defaultValue: 'Save' })}
            aria-pressed={wishlisted}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground/70 shadow-sm backdrop-blur transition-colors hover:text-primary"
          >
            <Heart size={16} className={cn(wishlisted && 'fill-primary text-primary')} />
          </button>

          {/* Quick action: slides up on hover on desktop; a round button on touch screens. */}
          {product.isAvailable && (
            <>
              <button
                onClick={handleAction}
                className="absolute inset-x-3 bottom-3 hidden translate-y-3 items-center justify-center gap-2 rounded-full bg-background/95 py-2.5 text-xs font-semibold opacity-0 shadow-lift backdrop-blur transition-all duration-300 hover:bg-foreground hover:text-background group-hover:translate-y-0 group-hover:opacity-100 md:flex"
              >
                <ActionIcon size={14} /> {actionLabel}
              </button>
              <button
                onClick={handleAction}
                aria-label={actionLabel}
                className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-background/95 shadow-lift md:hidden"
              >
                <ActionIcon size={16} />
              </button>
            </>
          )}
        </div>

        <div className="flex flex-1 flex-col px-0.5 pt-3">
          {product.category && (
            <p className="mb-1 line-clamp-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {categoryLabel(product.category, t)}
            </p>
          )}
          <h3 className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-primary md:text-[15px]">{product.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{priceLabel(product, t)}</span>
            {hasDiscount && product.price && (
              <span className="text-xs text-muted-foreground line-through">{product.price.toLocaleString()}</span>
            )}
          </div>
          {product.colors && product.colors.length > 1 && (
            <div className="mt-2 flex items-center gap-1">
              {product.colors.slice(0, 5).map((c) => (
                <span key={c.id} title={c.name} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: c.hexCode || '#ccc' }} />
              ))}
              {product.colors.length > 5 && <span className="text-[11px] text-muted-foreground">+{product.colors.length - 5}</span>}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
