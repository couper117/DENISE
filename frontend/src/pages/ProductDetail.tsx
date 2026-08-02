import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Heart, Share2, ChevronLeft, ZoomIn, ChevronRight,
  Star, Store, Package, Truck, ThumbsUp, CheckCircle,
} from 'lucide-react';
import { productsApi, reviewsApi } from '../lib/api';
import { useCartStore } from '../store';
import { Product, ProductReview, FulfillmentType } from '../types';
import ProductCard from '../components/products/ProductCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { cn } from '../lib/utils';

const PURCHASE_OPTIONS: {
  type: FulfillmentType;
  icon: React.ReactNode;
  label: string;
  sub: string;
  color: string;
}[] = [
  {
    type: 'RESERVATION',
    icon: <Store size={18} />,
    label: 'Reserve & Visit',
    sub: 'No payment now',
    color: 'border-brand-green text-brand-green bg-green-50 dark:bg-green-950/20',
  },
  {
    type: 'PICKUP',
    icon: <Package size={18} />,
    label: 'Buy + Pickup',
    sub: 'Pay online',
    color: 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20',
  },
  {
    type: 'DELIVERY',
    icon: <Truck size={18} />,
    label: 'Buy + Delivery',
    sub: 'Rwanda-wide',
    color: 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950/20',
  },
];

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s} size={size}
        className={s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}
      />
    ))}
  </div>
);

const ReviewCard = ({ review }: { review: ProductReview }) => (
  <div className="border border-border rounded-xl p-4">
    <div className="flex items-start justify-between gap-3 mb-2">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{review.customerName}</span>
          {review.isVerified && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle size={11} /> Verified
            </span>
          )}
        </div>
        <StarRating rating={review.rating} />
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {new Date(review.createdAt).toLocaleDateString('en-RW', { year: 'numeric', month: 'short', day: 'numeric' })}
      </span>
    </div>
    {review.title && <p className="font-medium text-sm mb-1">{review.title}</p>}
    <p className="text-sm text-muted-foreground">{review.message}</p>
    {review.helpfulCount > 0 && (
      <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
        <ThumbsUp size={11} /> {review.helpfulCount} found this helpful
      </div>
    )}
  </div>
);

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { addItem, items } = useCartStore();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [tab, setTab] = useState<'description' | 'specs' | 'materials' | 'reviews'>('description');
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', message: '', name: '' });
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => productsApi.getBySlug(slug!).then((r) => r.data.data as Product & { related: Product[] }),
    enabled: !!slug,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', data?.id],
    queryFn: () => reviewsApi.getForProduct(data!.id).then((r) => r.data.data as ProductReview[]),
    enabled: !!data?.id,
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">😕</div>
      <h2 className="text-xl font-semibold">Product not found</h2>
      <Link to="/products" className="text-primary hover:underline">← Back to Products</Link>
    </div>
  );

  const product = data;
  const reviews = reviewsData ?? product.reviews ?? [];
  const inCart = items.some((i) => i.product.id === product.id);

  const handlePurchaseOption = (type: FulfillmentType) => {
    if (!inCart) addItem(product);
    navigate(`/reservation?mode=${type}`);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await reviewsApi.create({
        productId: product.id,
        rating: reviewForm.rating,
        title: reviewForm.title || undefined,
        message: reviewForm.message,
        customerName: reviewForm.name,
      });
      setReviewSubmitted(true);
    } catch {
      // silently fail — review pending moderation
      setReviewSubmitted(true);
    }
  };

  const reviewStats = product.reviewStats ?? (
    reviews.length > 0
      ? { avg: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length, count: reviews.length }
      : null
  );

  const displayPrice = product.salePrice ?? product.price;
  const hasDiscount = product.salePrice && product.price && product.salePrice < product.price;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap">
        <Link to="/" className="hover:text-primary">Home</Link>
        <ChevronRight size={14} />
        <Link to="/products" className="hover:text-primary">Products</Link>
        <ChevronRight size={14} />
        <Link to={`/products?category=${product.category?.slug}`} className="hover:text-primary">
          {product.category?.name}
        </Link>
        <ChevronRight size={14} />
        <span className="text-foreground truncate max-w-32">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
        {/* Images */}
        <div>
          <div
            className="relative aspect-square bg-muted rounded-2xl overflow-hidden mb-3 cursor-zoom-in"
            onClick={() => setZoomed(true)}
          >
            {product.images && product.images.length > 0 ? (
              <motion.img
                key={selectedImage} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                src={product.images[selectedImage]?.url} alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">🧵</div>
            )}
            {product.images && product.images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedImage((s) => (s - 1 + product.images.length) % product.images.length); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedImage((s) => (s + 1) % product.images.length); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            <div className="absolute top-3 right-3 bg-white/80 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
              <ZoomIn size={12} /> {t('products.zoom')}
            </div>
            {hasDiscount && (
              <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                SALE
              </div>
            )}
          </div>

          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button key={img.id} onClick={() => setSelectedImage(i)}
                  className={cn('w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors shrink-0',
                    i === selectedImage ? 'border-primary' : 'border-border hover:border-primary/50')}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex gap-2 mb-2 flex-wrap">
            {product.isNewArrival && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">New Arrival</span>
            )}
            {product.isFeatured && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">Featured</span>
            )}
            {product.isOnPromotion && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                {product.promotionText || 'On Sale'}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-1">{product.category?.name}</p>
          <h1 className="font-serif text-2xl md:text-3xl font-bold mb-3">{product.name}</h1>

          {/* Reviews summary */}
          {reviewStats && (
            <div className="flex items-center gap-3 mb-4">
              <StarRating rating={Math.round(reviewStats.avg)} size={16} />
              <span className="text-sm text-muted-foreground">
                {reviewStats.avg.toFixed(1)} ({reviewStats.count} review{reviewStats.count !== 1 ? 's' : ''})
              </span>
            </div>
          )}

          {/* Price */}
          <div className="mb-4">
            {displayPrice ? (
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-primary">
                  {displayPrice.toLocaleString()} {product.currency}
                </span>
                {hasDiscount && product.price && (
                  <span className="text-base text-muted-foreground line-through">
                    {product.price.toLocaleString()} {product.currency}
                  </span>
                )}
                {product.pricePerMeter && (
                  <span className="text-sm text-muted-foreground">/ meter</span>
                )}
              </div>
            ) : product.priceRange ? (
              <p className="text-xl font-bold text-primary">{product.priceRange}</p>
            ) : (
              <p className="text-base text-muted-foreground italic">Contact for pricing</p>
            )}
          </div>

          {/* Colors */}
          {product.colors && product.colors.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">{t('products.available_colors')}</p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 px-3 py-1 border border-border rounded-full text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hexCode || '#ccc' }} />
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Availability */}
          <div className={cn('inline-flex items-center gap-1.5 text-sm font-medium mb-6 px-3 py-1.5 rounded-full',
            product.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
            <span className={cn('w-2 h-2 rounded-full', product.isAvailable ? 'bg-green-500' : 'bg-red-500')} />
            {product.isAvailable ? t('products.in_stock') : t('products.out_of_stock')}
            {product.inventory?.stockCount !== undefined && product.inventory.stockCount > 0 && (
              <span className="text-muted-foreground"> ({product.inventory.stockCount} in stock)</span>
            )}
          </div>

          {/* Three purchase options */}
          {product.isAvailable && (
            <div className="mb-6">
              <p className="text-sm font-medium mb-3">How would you like to get this?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PURCHASE_OPTIONS.filter((opt) => {
                  if (opt.type === 'DELIVERY' && !product.canBeDelivered) return false;
                  if ((opt.type === 'PICKUP' || opt.type === 'DELIVERY') && !product.canBuyOnline) return false;
                  return true;
                }).map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => handlePurchaseOption(opt.type)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 border-2 rounded-xl text-center transition-all hover:scale-[1.02] active:scale-[0.98]',
                      opt.color
                    )}
                  >
                    {opt.icon}
                    <span className="font-semibold text-xs">{opt.label}</span>
                    <span className="text-xs opacity-70">{opt.sub}</span>
                  </button>
                ))}
              </div>
              {inCart && (
                <p className="text-xs text-primary mt-2 text-center">✓ Already in cart</p>
              )}
            </div>
          )}

          <div className="flex gap-3 mb-6">
            {!product.isAvailable && (
              <div className="flex-1 flex items-center justify-center py-3 bg-muted text-muted-foreground font-medium rounded-xl text-sm">
                Out of Stock
              </div>
            )}
            <button
              className="p-3 border border-border rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-red-500"
            >
              <Heart size={18} />
            </button>
            <button
              onClick={() => navigator.share?.({ title: product.name, url: window.location.href })}
              className="p-3 border border-border rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-primary"
            >
              <Share2 size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-border mb-4">
            <div className="flex gap-1 overflow-x-auto">
              {(['description', 'specs', 'materials', 'reviews'] as const).map((t_) => {
                const labels: Record<string, string> = {
                  description: 'Description',
                  specs: 'Specifications',
                  materials: 'Materials',
                  reviews: `Reviews${reviews.length > 0 ? ` (${reviews.length})` : ''}`,
                };
                return (
                  <button key={t_} onClick={() => setTab(t_)}
                    className={cn('pb-2 px-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                      tab === t_ ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    {labels[t_]}
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground leading-relaxed">
              {tab === 'description' && <p>{product.description || 'No description available.'}</p>}
              {tab === 'specs' && <p className="whitespace-pre-wrap">{product.specifications || 'No specifications available.'}</p>}
              {tab === 'materials' && <p>{product.material || 'No material information available.'}</p>}
              {tab === 'reviews' && (
                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">No reviews yet. Be the first!</p>
                  ) : (
                    reviews.map((r) => <ReviewCard key={r.id} review={r} />)
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Write a Review */}
      <section className="bg-card border border-border rounded-2xl p-6 mb-12">
        <h2 className="font-serif text-xl font-bold mb-4">Write a Review</h2>
        {reviewSubmitted ? (
          <div className="text-center py-6">
            <CheckCircle className="text-green-500 mx-auto mb-2" size={32} />
            <p className="font-medium">Thank you for your review!</p>
            <p className="text-sm text-muted-foreground">Your review will appear after approval.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Your Rating *</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setReviewForm((p) => ({ ...p, rating: s }))}>
                    <Star size={24}
                      className={s <= reviewForm.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-300'}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Your Name *</label>
                <input required value={reviewForm.name}
                  onChange={(e) => setReviewForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Jean-Pierre" className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Review Title</label>
                <input value={reviewForm.title}
                  onChange={(e) => setReviewForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Summary of your experience" className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Your Review *</label>
              <textarea required rows={3} value={reviewForm.message}
                onChange={(e) => setReviewForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Share your experience with this product..."
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <button type="submit"
              className="px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors">
              Submit Review
            </button>
          </form>
        )}
      </section>

      {/* Related Products */}
      {product.related && product.related.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl font-bold mb-6">{t('products.related')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {product.related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}

      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomed && product.images?.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setZoomed(false)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              src={product.images[selectedImage]?.url} alt={product.name}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()} />
            <button className="absolute top-4 right-4 text-white hover:text-white/70" onClick={() => setZoomed(false)}>
              <span className="text-2xl">✕</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductDetail;
