import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Minus, Pencil, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { useCartStore } from '../store';
import { CartItem } from '../types';
import { describeConfiguration, MAX_QUANTITY } from '../lib/productOptions';
import { toast } from '../components/ui/Toaster';
import FabricEstimator from '../components/reservation/FabricEstimator';
import Seo from '../components/Seo';
import { EditableText } from '../cms';
import { cn } from '../lib/utils';

const money = (value: number, currency = 'RWF') => `${value.toLocaleString()} ${currency}`;

const CartLine = ({ item }: { item: CartItem }) => {
  const { t } = useTranslation();
  const { setQuantity, removeLine } = useCartStore();
  const image = item.product.images?.find((i) => i.isPrimary) || item.product.images?.[0];
  const specs = describeConfiguration(item.config);
  const currency = item.product.currency || 'RWF';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="bg-card border border-border rounded-2xl p-4 sm:p-5"
    >
      <div className="flex gap-4">
        <Link to={`/products/${item.product.slug}`} className="shrink-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-xl overflow-hidden">
            {image ? (
              <img src={image.url} alt={item.product.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🧵</div>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to={`/products/${item.product.slug}`}
                className="font-medium text-sm sm:text-base leading-snug hover:text-primary transition-colors line-clamp-2"
              >
                {item.product.name}
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5">{item.product.category?.name}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                removeLine(item.id);
                toast({ title: t('cart.removed', { defaultValue: 'Removed from cart' }), description: item.product.name });
              }}
              aria-label={`${t('common.delete')} — ${item.product.name}`}
              className="shrink-0 p-1.5 -m-1.5 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Selected configuration — the whole point of the new product page,
              so it stays legible rather than hiding behind a "details" toggle. */}
          {specs.length > 0 && (
            <dl className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {specs.map((spec) => (
                <div key={spec.label} className="flex items-center gap-1 text-xs">
                  <dt className="text-muted-foreground">{t(`cart.spec.${spec.label.toLowerCase()}`, { defaultValue: spec.label })}:</dt>
                  <dd className="font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {item.config.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-2">“{item.config.notes}”</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded-lg">
                <button
                  type="button"
                  onClick={() => setQuantity(item.id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  aria-label={t('cart.decrease', { defaultValue: 'Decrease quantity' })}
                  className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={MAX_QUANTITY}
                  value={item.quantity}
                  onChange={(e) => setQuantity(item.id, Math.floor(Number(e.target.value)) || 1)}
                  aria-label={t('config.quantity', { defaultValue: 'Quantity' })}
                  className="w-12 text-center bg-transparent text-sm font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(item.id, item.quantity + 1)}
                  disabled={item.quantity >= MAX_QUANTITY}
                  aria-label={t('cart.increase', { defaultValue: 'Increase quantity' })}
                  className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              <Link
                to={`/products/${item.product.slug}?line=${item.id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Pencil size={12} /> {t('cart.edit', { defaultValue: 'Edit' })}
              </Link>
            </div>

            <div className="text-right">
              {item.lineTotal != null ? (
                <>
                  <p className="font-semibold text-primary">{money(item.lineTotal, currency)}</p>
                  {item.unitPrice != null && item.quantity > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {money(item.unitPrice, currency)} {t('cart.each', { defaultValue: 'each' })}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground max-w-[12rem]">
                  {t('cart.price_on_request', { defaultValue: 'Price confirmed by our team' })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.li>
  );
};

const Cart = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, itemCount, subtotal, discount, hasQuotedItems, clearCart } = useCartStore();

  const count = itemCount();
  const goods = subtotal();
  const saved = discount();

  return (
    <div className="container mx-auto px-4 py-8">
      <Seo
        path="/cart"
        title="Your Cart — DENISE Textile Rwanda"
        description="Review the curtains and fabrics you have configured before checking out."
      />

      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <EditableText id="cart.title" as="h1" className="font-serif text-2xl sm:text-3xl font-bold" />
            <p className="text-sm text-muted-foreground mt-1">
              {count === 0
                ? t('cart.empty_subtitle', { defaultValue: 'Nothing here yet.' })
                : t('cart.subtitle', { defaultValue: '{{count}} item(s) ready to order', count })}
            </p>
          </div>
          <Link to="/products" className="text-sm font-medium text-primary hover:underline">
            ← {t('reservation.continue_shopping')}
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 sm:p-16 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
              <ShoppingBag size={26} className="text-muted-foreground" />
            </div>
            <EditableText id="reservation.cart_empty" as="p" className="font-medium text-lg mb-2" />
            <p className="text-sm text-muted-foreground mb-6">
              {t('cart.empty_hint', { defaultValue: 'Browse our curtains and fabrics, configure what you need, and it will show up here.' })}
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <EditableText id="reservation.browse_products" /> <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <ul className="space-y-4">
                <AnimatePresence initial={false}>
                  {items.map((item) => <CartLine key={item.id} item={item} />)}
                </AnimatePresence>
              </ul>

              <div className="flex justify-between items-center pt-1">
                <Link to="/products" className="text-sm font-medium text-primary hover:underline">
                  ← {t('reservation.continue_shopping')}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    clearCart();
                    toast({ title: t('cart.cleared', { defaultValue: 'Cart cleared' }) });
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  {t('cart.clear', { defaultValue: 'Clear cart' })}
                </button>
              </div>

              {/* Kept from the old reservation page — customers buying fabric by
                  the metre still use it to work out how much to order. */}
              <div className="lg:hidden"><FabricEstimator /></div>
            </div>

            {/* ── Order summary ────────────────────────────────────────────── */}
            <div className="space-y-4 lg:sticky lg:top-24">
              <div className="bg-card border border-border rounded-2xl p-5">
                <EditableText id="reservation.order_summary" as="h2" className="font-semibold mb-4" />

                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {t('cart.subtotal', { defaultValue: 'Subtotal' })} ({count})
                    </dt>
                    <dd className="font-medium">{money(goods)}</dd>
                  </div>

                  {saved > 0 && (
                    <div className="flex justify-between text-green-700 dark:text-green-400">
                      <dt>{t('cart.discount', { defaultValue: 'Discount' })}</dt>
                      <dd className="font-medium">−{money(saved)}</dd>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <dt className="text-muted-foreground flex items-center gap-1.5">
                      <Truck size={13} /> <EditableText id="delivery.fee" />
                    </dt>
                    <dd className="text-muted-foreground text-xs text-right max-w-[9rem]">
                      {t('cart.delivery_at_checkout', { defaultValue: 'Calculated at checkout' })}
                    </dd>
                  </div>

                  <div className="flex justify-between items-baseline border-t border-border pt-3 mt-1">
                    <dt className="font-semibold">{t('cart.estimated_total', { defaultValue: 'Estimated total' })}</dt>
                    <dd className="text-xl font-bold text-primary">{money(goods)}</dd>
                  </div>
                </dl>

                {hasQuotedItems() && (
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                    {t('cart.quote_note', { defaultValue: 'Some items are priced on request. Our team confirms the final price before you pay anything.' })}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => navigate('/checkout')}
                  className={cn(
                    'w-full mt-5 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold transition-colors',
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {t('reservation.checkout')} <ArrowRight size={16} />
                </button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-3">
                  <ShieldCheck size={13} className="text-primary" />
                  {t('cart.tax_note', { defaultValue: 'Prices include VAT where applicable' })}
                </p>
              </div>

              <div className="hidden lg:block"><FabricEstimator /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
