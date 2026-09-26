import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Share2, ChevronLeft, ChevronRight, Star, ThumbsUp, CheckCircle, Truck, Store,
  Smartphone, MessageCircle, ChevronDown, X, Expand,
} from 'lucide-react';
import { productsApi, reviewsApi, wishlistApi } from '../lib/api';
import { useAuthStore, useCartStore } from '../store';
import { Product, ProductReview } from '../types';
import { Configuration, curtainRole, detectKind } from '../lib/productOptions';
import { WHATSAPP_LINK } from '../lib/config';
import ProductCard from '../components/products/ProductCard';
import ProductConfigurator from '../components/products/ProductConfigurator';
import CurtainBuilder, { BuiltLine } from '../components/products/CurtainBuilder';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { toast } from '../components/ui/Toaster';
import Seo from '../components/Seo';
import Breadcrumbs from '../components/Breadcrumbs';
import { cn } from '../lib/utils';
import { categoryLabel, priceLabel } from '../lib/catalog';
import { useCustomerIdentity } from '../lib/useCustomerIdentity';
import { EditableText } from '../cms';

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} size={size} className={s <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
    ))}
  </div>
);

const ReviewCard = ({ review }: { review: ProductReview }) => {
  const { t, i18n } = useTranslation();
  return (
    <div className="surface p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium">{review.customerName}</span>
            {review.isVerified && (
              <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                <CheckCircle size={11} /> {t('reviews.verified', { defaultValue: 'Verified' })}
              </span>
            )}
          </div>
          <StarRating rating={review.rating} />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(review.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      </div>
      {review.title && <p className="mb-1 text-sm font-medium">{review.title}</p>}
      <p className="text-sm text-muted-foreground">{review.message}</p>
      {review.helpfulCount > 0 && (
        <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <ThumbsUp size={11} /> {t('reviews.helpful', { defaultValue: '{{count}} found this helpful', count: review.helpfulCount })}
        </div>
      )}
    </div>
  );
};

/** Collapsible detail section — keeps the buy box short on phones. */
const Detail = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold">
        {title} <ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pb-5 text-sm leading-relaxed text-muted-foreground">{children}</div>}
    </div>
  );
};

const inputClass = 'w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { addLine, updateLine, items } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // `?line=` means the customer came from the cart to change a line they
  // already configured, so the form is seeded from it and saves back to it.
  const editingLineId = searchParams.get('line');
  const editingLine = items.find((i) => i.id === editingLineId);
  const [selectedImage, setSelectedImage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', message: '', name: '' });
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const identity = useCustomerIdentity();

  useEffect(() => {
    if (!identity.isSignedIn) return;
    setReviewForm((f) => (f.name ? f : { ...f, name: identity.name }));
  }, [identity]);

  useEffect(() => { setSelectedImage(0); }, [slug]);

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
    <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>
  );
  if (error || !data) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="font-serif text-2xl font-semibold">{t('products.not_found', { defaultValue: 'Product not found' })}</h2>
      <Link to="/products" className="btn btn-outline">← {t('products.back', { defaultValue: 'Back to products' })}</Link>
    </div>
  );

  const product = data;
  const images = product.images ?? [];
  const reviews = reviewsData ?? product.reviews ?? [];
  const linesForProduct = items.filter((i) => i.product.id === product.id).length;
  const isCurtain = detectKind(product) === 'CURTAIN';
  const useBuilder = isCurtain && !editingLine;

  const handleConfigured = (config: Configuration, quantity: number) => {
    if (editingLine) {
      updateLine(editingLine.id, config, quantity);
      toast({ title: t('cart.updated', { defaultValue: 'Cart updated' }), variant: 'success' });
      navigate('/cart');
      return;
    }
    addLine(product, config, quantity);
    toast({ title: t('cart.added', { defaultValue: 'Added to cart' }), description: product.name, variant: 'success' });
  };

  // Buy now: add the configured line, then jump straight to checkout. Existing
  // cart items still come along — it's the same basket, just a faster path.
  const handleBuyNow = (config: Configuration, quantity: number) => {
    addLine(product, config, quantity);
    navigate('/checkout');
  };

  const handleBuilt = (lines: BuiltLine[], buyNow: boolean) => {
    lines.forEach((l) => addLine(l.product, l.config, l.quantity));
    if (buyNow) {
      navigate('/checkout');
      return;
    }
    toast({
      title: t('cart.added', { defaultValue: 'Added to cart' }),
      description: lines.map((l) => l.product.name).join(' + '),
      variant: 'success',
    });
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/products/${product.slug}` } } });
      return;
    }
    try {
      if (wishlisted) await wishlistApi.remove(product.id);
      else await wishlistApi.add(product.id);
      setWishlisted((v) => !v);
    } catch { /* keep the heart as it was */ }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: product.name, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast({ title: t('products.link_copied', { defaultValue: 'Link copied' }) }));
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
    } catch { /* reviews are moderated either way */ }
    setReviewSubmitted(true);
  };

  const reviewStats = product.reviewStats ?? (
    reviews.length > 0 ? { avg: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length, count: reviews.length } : null
  );

  const hasDiscount = !!(product.salePrice && product.price && product.salePrice < product.price);
  const seoImage = images.find((i) => i.isPrimary)?.url || images[0]?.url;
  const cat = product.category;
  // Hidden when the category already says it ("Hard Curtains (Rideau de nuit)").
  const roleBadge = isCurtain && !/hard-curtains|soft-curtains/.test(cat?.slug ?? '')
    ? (curtainRole(product) === 'SOFT'
        ? t('curtain.role_soft', { defaultValue: 'Day curtain (rideau du jour)' })
        : t('curtain.role_hard', { defaultValue: 'Night curtain (rideau de nuit)' }))
    : null;

  const trust = [
    { icon: Truck, text: t('config.badge_delivery', { defaultValue: 'Delivery across Rwanda' }), show: product.canBeDelivered },
    { icon: Smartphone, text: t('products.trust_momo', { defaultValue: 'Pay with MTN MoMo' }), show: true },
    { icon: Store, text: t('config.badge_pickup', { defaultValue: 'Collect from our Kigali shop' }), show: true },
  ].filter((x) => x.show);

  return (
    <div className="shop-container py-6 md:py-10">
      <Seo
        path={`/products/${product.slug}`}
        title={`${product.name} — DENISE Textile Rwanda`}
        description={product.description ? product.description.slice(0, 155) : `Buy ${product.name} at DENISE Textile Kigali. Order online with delivery across Rwanda.`}
        image={seoImage}
        type="product"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          image: seoImage || [],
          description: product.description || product.name,
          brand: { '@type': 'Brand', name: 'DENISE Textile' },
          ...((product.salePrice ?? product.price ?? product.pricePerMeter)
            ? {
                offers: {
                  '@type': 'Offer',
                  price: product.salePrice ?? product.price ?? product.pricePerMeter,
                  priceCurrency: product.currency || 'RWF',
                  availability: product.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                  url: `https://deniseshop.com/products/${product.slug}`,
                },
              }
            : {}),
        }}
      />
      <Breadcrumbs items={[
        { label: t('nav.products'), to: '/products' },
        ...(cat ? [{ label: categoryLabel(cat, t), to: `/products?category=${cat.slug}` }] : []),
        { label: product.name },
      ]} />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        {/* ── Gallery ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-40">
            <div className="flex flex-col-reverse gap-3 md:flex-row">
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto md:w-20 md:flex-col md:overflow-visible">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImage(i)}
                      aria-label={`${product.name} ${i + 1}`}
                      className={cn('aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors md:w-full',
                        i === selectedImage ? 'border-foreground' : 'border-transparent opacity-70 hover:opacity-100')}
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="relative flex-1">
                <button
                  type="button"
                  className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-2xl bg-muted"
                  onClick={() => images.length > 0 && setZoomed(true)}
                  aria-label={t('products.zoom', { defaultValue: 'Zoom' })}
                >
                  {images.length > 0 ? (
                    <motion.img
                      key={selectedImage} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      src={images[selectedImage]?.url} alt={images[selectedImage]?.altText || product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-serif text-6xl text-muted-foreground/40">D</div>
                  )}
                  {images.length > 0 && (
                    <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition-opacity group-hover:opacity-100">
                      <Expand size={15} />
                    </span>
                  )}
                </button>
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImage((s) => (s - 1 + images.length) % images.length)}
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow"
                    ><ChevronLeft size={18} /></button>
                    <button
                      onClick={() => setSelectedImage((s) => (s + 1) % images.length)}
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow"
                    ><ChevronRight size={18} /></button>
                  </>
                )}
                <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
                  {hasDiscount && <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">{t('products.promo')}</span>}
                  {product.isNewArrival && <span className="rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">{t('products.new')}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Buy box ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-5">
          <div className="flex flex-wrap items-center gap-2">
            {cat && <Link to={`/products?category=${cat.slug}`} className="eyebrow hover:underline">{categoryLabel(cat, t)}</Link>}
            {roleBadge && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium">{roleBadge}</span>}
          </div>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{product.name}</h1>

          {reviewStats && (
            <a href="#reviews" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <StarRating rating={Math.round(reviewStats.avg)} size={15} />
              {reviewStats.avg.toFixed(1)} · {t('reviews.count', { defaultValue: '{{count}} reviews', count: reviewStats.count })}
            </a>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{priceLabel(product, t)}</span>
            {hasDiscount && product.price && (
              <span className="text-base text-muted-foreground line-through">{product.price.toLocaleString()} {product.currency}</span>
            )}
          </div>

          {product.description && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{product.description}</p>}

          <div className={cn('mt-4 inline-flex items-center gap-2 text-sm font-medium', product.isAvailable ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
            <span className={cn('h-2 w-2 rounded-full', product.isAvailable ? 'bg-green-500' : 'bg-destructive')} />
            {product.isAvailable ? t('products.in_stock') : t('products.out_of_stock')}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
            {editingLine && (
              <h2 className="mb-4 font-serif text-lg font-semibold">{t('cart.edit_item', { defaultValue: 'Edit this item' })}</h2>
            )}
            {useBuilder ? (
              <CurtainBuilder product={product} onAdd={handleBuilt} />
            ) : (
              <ProductConfigurator
                key={editingLine?.id ?? 'new'}
                product={product}
                mode={editingLine ? 'edit' : 'add'}
                initialConfig={editingLine?.config}
                initialQuantity={editingLine?.quantity}
                onSubmit={handleConfigured}
                onBuyNow={editingLine ? undefined : handleBuyNow}
              />
            )}
            {!editingLine && linesForProduct > 0 && (
              <Link to="/cart" className="btn btn-outline mt-3 w-full">
                <CheckCircle size={14} className="text-primary" />
                {t('cart.in_cart_view', { defaultValue: '{{count}} in your cart — view cart', count: linesForProduct })}
              </Link>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={handleWishlist} className="btn btn-outline flex-1" aria-pressed={wishlisted}>
              <Heart size={16} className={cn(wishlisted && 'fill-primary text-primary')} /> {t('products.save', { defaultValue: 'Save' })}
            </button>
            <button type="button" onClick={handleShare} className="btn btn-outline flex-1">
              <Share2 size={16} /> {t('products.share', { defaultValue: 'Share' })}
            </button>
          </div>

          <ul className="mt-6 grid gap-3 rounded-2xl bg-muted/50 p-4 text-sm">
            {trust.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3"><Icon size={17} className="shrink-0 text-primary" /> {text}</li>
            ))}
            <li>
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 font-medium text-[#1f8f4e] hover:underline">
                <MessageCircle size={17} className="shrink-0" /> {t('products.ask_whatsapp', { defaultValue: 'Questions? Ask us on WhatsApp' })}
              </a>
            </li>
          </ul>

          <div className="mt-6 border-t border-border">
            <Detail title={t('products.tab_description', { defaultValue: 'Description' })} defaultOpen>
              <p className="whitespace-pre-line">{product.description || t('products.no_description', { defaultValue: 'No description available.' })}</p>
            </Detail>
            {product.specifications && (
              <Detail title={t('products.tab_specs', { defaultValue: 'Specifications' })}>
                <p className="whitespace-pre-wrap">{product.specifications}</p>
              </Detail>
            )}
            {product.material && (
              <Detail title={t('products.tab_materials', { defaultValue: 'Materials' })}>
                <p>{product.material}</p>
              </Detail>
            )}
            <Detail title={t('products.tab_delivery', { defaultValue: 'Delivery & payment' })}>
              <p>{t('products.delivery_text', { defaultValue: 'Choose delivery anywhere in Rwanda, collection from our Kigali shop, or reserve and pay when you visit. Pay with MTN MoMo, bank transfer or in store. Made-to-measure curtains are cut after our team confirms your measurements.' })}</p>
            </Detail>
          </div>
        </div>
      </div>

      {/* ── Reviews ─────────────────────────────────────────────────────────── */}
      <section id="reviews" className="mt-16 grid gap-8 scroll-mt-40 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 className="section-title">{t('reviews.title', { defaultValue: 'Customer reviews' })}</h2>
          {reviewStats ? (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-4xl font-semibold">{reviewStats.avg.toFixed(1)}</span>
              <div>
                <StarRating rating={Math.round(reviewStats.avg)} size={16} />
                <p className="text-xs text-muted-foreground">{t('reviews.count', { defaultValue: '{{count}} reviews', count: reviewStats.count })}</p>
              </div>
            </div>
          ) : (
            <p className="section-lead">{t('reviews.none', { defaultValue: 'No reviews yet. Be the first!' })}</p>
          )}

          <div className="surface mt-6 p-5">
            <h3 className="mb-4 font-semibold">{t('reviews.write', { defaultValue: 'Write a review' })}</h3>
            {reviewSubmitted ? (
              <div className="py-4 text-center">
                <CheckCircle className="mx-auto mb-2 text-green-600" size={28} />
                <p className="font-medium">{t('reviews.thanks', { defaultValue: 'Thank you for your review!' })}</p>
                <p className="text-sm text-muted-foreground">{t('reviews.pending', { defaultValue: 'Your review will appear after approval.' })}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="flex gap-1" role="radiogroup" aria-label={t('reviews.rating', { defaultValue: 'Your rating' })}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={reviewForm.rating === s} aria-label={`${s}`} onClick={() => setReviewForm((p) => ({ ...p, rating: s }))}>
                      <Star size={24} className={s <= reviewForm.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
                    </button>
                  ))}
                </div>
                <input required value={reviewForm.name} onChange={(e) => setReviewForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder={t('reviews.name', { defaultValue: 'Your name' })} aria-label={t('reviews.name', { defaultValue: 'Your name' })} className={inputClass} />
                <input value={reviewForm.title} onChange={(e) => setReviewForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder={t('reviews.title_field', { defaultValue: 'Title (optional)' })} aria-label={t('reviews.title_field', { defaultValue: 'Title (optional)' })} className={inputClass} />
                <textarea required rows={3} value={reviewForm.message} onChange={(e) => setReviewForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder={t('reviews.message', { defaultValue: 'Share your experience with this product…' })} aria-label={t('reviews.message', { defaultValue: 'Share your experience with this product…' })} className={cn(inputClass, 'resize-none')} />
                <button type="submit" className="btn btn-dark">{t('reviews.submit', { defaultValue: 'Submit review' })}</button>
              </form>
            )}
          </div>
        </div>
        <div className="space-y-3 lg:col-span-7">
          {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      </section>

      {/* ── Related ─────────────────────────────────────────────────────────── */}
      {product.related && product.related.length > 0 && (
        <section className="mt-16">
          <EditableText id="products.related" as="h2" className="section-title mb-6" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {product.related.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}

      {/* ── Zoom ────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {zoomed && images.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomed(false)}>
            <motion.img initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              src={images[selectedImage]?.url} alt={product.name}
              className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
            <button className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setZoomed(false)} aria-label="Close">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductDetail;
