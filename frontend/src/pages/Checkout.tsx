import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle, Building2, Calendar, Check, CheckCircle2, ChevronRight, Clock, CreditCard,
  Loader2, Mail, MapPin, MessageSquare, Package, Phone, ShieldCheck, Smartphone, Store, Truck, User,
} from 'lucide-react';
import { useCartStore } from '../store';
import { reservationsApi } from '../lib/api';
import { CartItem, DeliveryType, FulfillmentType, PaymentMethod, Reservation } from '../types';
import { describeConfiguration } from '../lib/productOptions';
import { generateTimeSlots, getMinReservationDate, cn } from '../lib/utils';
import { RWANDA_PROVINCES, getDistrictsForProvince, getDeliveryFee } from '../lib/rwanda';
import {
  AIRTEL_ENABLED, BANK_TRANSFER_ENABLED, CARD_ENABLED, PAY_ON_COLLECTION_ENABLED,
  buildMobileMoneyDial, MobileMoneyMethod,
} from '../lib/config';
import { fillBlanks, useCustomerIdentity } from '../lib/useCustomerIdentity';
import { toast } from '../components/ui/Toaster';
import Breadcrumbs from '../components/Breadcrumbs';
import Seo from '../components/Seo';
import { EditableText } from '../cms';

type Step = 'delivery' | 'review' | 'payment' | 'success';

const STEPS: { id: Step; labelKey: string; fallback: string }[] = [
  { id: 'delivery', labelKey: 'checkout.step_delivery', fallback: 'Delivery' },
  { id: 'review', labelKey: 'checkout.step_review', fallback: 'Review' },
  { id: 'payment', labelKey: 'checkout.step_payment', fallback: 'Payment' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ln', label: 'Lingala' },
];

const FULFILLMENT_OPTIONS: {
  type: FulfillmentType;
  icon: typeof Truck;
  titleKey: string;
  descKey: string;
}[] = [
  { type: 'DELIVERY', icon: Truck, titleKey: 'fulfillment.DELIVERY', descKey: 'fulfillment.delivery_desc' },
  { type: 'PICKUP', icon: Package, titleKey: 'fulfillment.PICKUP', descKey: 'fulfillment.pickup_desc' },
  { type: 'RESERVATION', icon: Store, titleKey: 'fulfillment.RESERVATION', descKey: 'fulfillment.reserve_desc' },
];

const DELIVERY_TYPES: { type: DeliveryType; labelKey: string; descKey: string; extraKey: string }[] = [
  { type: 'SAME_DAY', labelKey: 'delivery.SAME_DAY', descKey: 'delivery.same_day_note', extraKey: 'delivery.extra_same_day' },
  { type: 'NEXT_DAY', labelKey: 'delivery.NEXT_DAY', descKey: 'delivery.next_day_note', extraKey: 'delivery.extra_included' },
  { type: 'SCHEDULED', labelKey: 'delivery.SCHEDULED', descKey: 'delivery.scheduled_note', extraKey: 'delivery.extra_included' },
];

const SAME_DAY_SURCHARGE = 1000;

const field =
  'w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
const card = 'bg-card border border-border rounded-2xl p-5 sm:p-6';

const money = (value: number) => `${Math.round(value).toLocaleString()} RWF`;

/** Line description shared by the review step, the summary rail and the receipt. */
const LineSummary = ({ item, compact = false }: { item: CartItem; compact?: boolean }) => {
  const { t } = useTranslation();
  const image = item.product.images?.find((i) => i.isPrimary) || item.product.images?.[0];
  const specs = describeConfiguration(item.config);
  return (
    <div className="flex gap-3">
      <div className={cn('bg-muted rounded-lg overflow-hidden shrink-0', compact ? 'w-10 h-10' : 'w-14 h-14')}>
        {image ? <img src={image.url} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium leading-snug', compact ? 'text-xs' : 'text-sm')}>{item.product.name}</p>
        {specs.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {specs.map((s) => `${s.value}`).join(' · ')}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('checkout.qty', { defaultValue: 'Qty' })} {item.quantity}
          {item.unitPrice != null && ` × ${money(item.unitPrice)}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        {item.lineTotal != null ? (
          <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>{money(item.lineTotal)}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('cart.price_on_request', { defaultValue: 'To be quoted' })}</p>
        )}
      </div>
    </div>
  );
};

const Checkout = () => {
  const { t } = useTranslation();
  const tr = (key: string, fallback: string, opts?: Record<string, unknown>) =>
    t(key, { defaultValue: fallback, ...opts });
  const navigate = useNavigate();
  const { items, subtotal, discount, hasQuotedItems, clearCart } = useCartStore();
  const identity = useCustomerIdentity();

  const [step, setStep] = useState<Step>('delivery');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('DELIVERY');
  const [confirmed, setConfirmed] = useState<Reservation | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');

  // Duplicate-submission guards. Two refs, because they cover different windows
  // and neither alone is enough:
  //
  //   `submittingRef` — set *synchronously* before the request goes out. React
  //     Query's `isPending` and any state-based flag are snapshots from the
  //     last render, so two clicks in the same tick both read the stale value
  //     and both fire. This was not hypothetical: a double click on Place order
  //     produced two identical orders six milliseconds apart.
  //   `placedRef` — set once an order exists and never cleared, so navigating
  //     back from the confirmation screen cannot order the same basket twice.
  const submittingRef = useRef(false);
  const placedRef = useRef(false);

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    preferredLanguage: 'en',
    visitDate: '',
    visitTime: '',
    notes: '',
    measurementOption: 'HELP_AT_SHOP',
    mobileMoneyPhone: '',
    deliveryType: 'NEXT_DAY' as DeliveryType,
    province: '',
    district: '',
    sector: '',
    cell: '',
    village: '',
    streetAddress: '',
    scheduledDate: '',
  });

  const update = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  // A signed-in customer should never retype what the account already knows.
  // Only blank fields are filled, so anything typed first survives.
  useEffect(() => {
    if (!identity.isSignedIn) return;
    setForm((f) => fillBlanks(f, {
      customerName: identity.name,
      customerPhone: identity.phone,
      customerEmail: identity.email,
      mobileMoneyPhone: identity.phone,
    }));
  }, [identity]);

  // An empty cart has nothing to check out. Placing an order is exempt: the
  // cart is deliberately emptied the moment one is created, and `placedRef`
  // rather than `step` is the test so no interleaving of the two state updates
  // can bounce the customer to an empty cart instead of their receipt.
  useEffect(() => {
    if (items.length === 0 && step !== 'success' && !placedRef.current) {
      navigate('/cart', { replace: true });
    }
  }, [items.length, step, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const goods = subtotal();
  const saved = discount();
  const isDelivery = fulfillmentType === 'DELIVERY';
  const isReservation = fulfillmentType === 'RESERVATION';

  const deliveryFee = useMemo(() => {
    if (!isDelivery || !form.province) return 0;
    return getDeliveryFee(form.province) + (form.deliveryType === 'SAME_DAY' ? SAME_DAY_SURCHARGE : 0);
  }, [isDelivery, form.province, form.deliveryType]);

  const grandTotal = goods + deliveryFee;
  const districtOptions = useMemo(() => getDistrictsForProvince(form.province), [form.province]);
  const timeSlots = useMemo(() => generateTimeSlots(), []);
  const minDate = getMinReservationDate();

  // ── Payment methods actually offered ──────────────────────────────────────
  // A reservation is paid for in person after inspecting the goods, so it never
  // reaches an online method. Everything else is gated on whether the shop can
  // honour it today (see lib/config.ts).
  const paymentOptions = useMemo(() => {
    const collectLabel = isDelivery
      ? tr('payment.cash_on_delivery', 'Cash on delivery')
      : tr('payment.pay_at_shop_label', 'Pay when you collect');
    if (isReservation) {
      return [{
        method: 'PAY_AT_SHOP' as PaymentMethod,
        icon: Store,
        label: tr('payment.pay_at_shop_label', 'Pay at the shop'),
        hint: tr('payment.pay_at_shop_hint', 'Pay in person after inspecting the products. No deposit needed.'),
      }];
    }
    return [
      {
        method: 'MTN_MOMO' as PaymentMethod, icon: Smartphone, label: t('payment.MTN_MOMO'),
        hint: tr('payment.momo_hint', 'Dial the payment prompt on your phone and confirm with your PIN.'),
      },
      ...(AIRTEL_ENABLED ? [{
        method: 'AIRTEL_MONEY' as PaymentMethod, icon: Smartphone, label: t('payment.AIRTEL_MONEY'),
        hint: tr('payment.momo_hint', 'Dial the payment prompt on your phone and confirm with your PIN.'),
      }] : []),
      ...(CARD_ENABLED ? [{
        method: 'VISA' as PaymentMethod, icon: CreditCard, label: tr('payment.card', 'Credit / debit card'),
        hint: tr('payment.card_hint', 'You will be redirected to a secure payment page.'),
      }] : []),
      ...(BANK_TRANSFER_ENABLED ? [{
        method: 'BANK_TRANSFER' as PaymentMethod, icon: Building2, label: t('payment.BANK_TRANSFER'),
        hint: tr('payment.bank_hint', 'We send you the account details once your order is confirmed.'),
      }] : []),
      ...(PAY_ON_COLLECTION_ENABLED ? [{
        method: 'PAY_AT_SHOP' as PaymentMethod, icon: Store, label: collectLabel,
        hint: isDelivery
          ? tr('payment.cod_hint', 'Pay the courier when your order arrives.')
          : tr('payment.collect_hint', 'Pay at the shop when you collect your order.'),
      }] : []),
    ];
  }, [isDelivery, isReservation, t]);

  // Keep the selection valid when the fulfilment choice changes the menu.
  useEffect(() => {
    if (isReservation) { setPaymentMethod('PAY_AT_SHOP'); return; }
    setPaymentMethod((current) => (current && paymentOptions.some((o) => o.method === current) ? current : ''));
  }, [isReservation, paymentOptions]);

  const isMobileMoney = paymentMethod === 'MTN_MOMO' || paymentMethod === 'AIRTEL_MONEY';

  // ── Order creation ────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      reservationsApi.create(payload).then((r) => r.data.data as Reservation),
    onSuccess: (order) => {
      placedRef.current = true;
      submittingRef.current = false;
      setConfirmed(order);
      setStep('success');
      // Only now — an order that failed must leave the cart exactly as it was.
      clearCart();
    },
    onError: () => {
      // Released so the customer can genuinely retry.
      submittingRef.current = false;
      toast({
        title: tr('checkout.error_title', 'We could not place your order'),
        description: tr('checkout.error_desc', 'Nothing was charged and your cart is safe. Please try again.'),
        variant: 'error',
      });
    },
  });

  const placeOrder = () => {
    if (submittingRef.current || placedRef.current || createMutation.isPending) return;
    submittingRef.current = true;

    const payload = {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail || undefined,
      preferredLanguage: form.preferredLanguage,
      fulfillmentType,
      visitDate: isReservation ? form.visitDate : undefined,
      visitTime: isReservation ? form.visitTime : undefined,
      notes: form.notes || undefined,
      measurementOption: isReservation ? form.measurementOption : 'HELP_AT_SHOP',
      paymentMethod: paymentMethod || 'PAY_AT_SHOP',
      mobileMoneyPhone: isMobileMoney ? form.mobileMoneyPhone : undefined,
      deliveryType: isDelivery ? form.deliveryType : undefined,
      deliveryAddress: isDelivery
        ? {
            province: form.province,
            district: form.district,
            sector: form.sector || undefined,
            cell: form.cell || undefined,
            village: form.village || undefined,
            streetAddress: form.streetAddress || undefined,
          }
        : undefined,
      scheduledDeliveryDate:
        isDelivery && form.deliveryType === 'SCHEDULED' ? form.scheduledDate : undefined,
      // Only the configuration travels — the server re-prices every line.
      items: items.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        metersRequired: line.config.meters ?? null,
        windowWidth: line.config.widthCm ?? null,
        windowHeight: line.config.dropCm ?? null,
        notes: line.config.notes || null,
        options: {
          color: line.config.color,
          headerType: line.config.headerType,
          lining: line.config.lining,
          panelLayout: line.config.panelLayout,
          fullness: line.config.fullness,
          widthCm: line.config.widthCm,
          dropCm: line.config.dropCm,
          meters: line.config.meters,
        },
      })),
    };

    createMutation.mutate(payload);
  };

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === 'success' && confirmed) {
    const paidOnline = confirmed.paymentStatus === 'COMPLETED';
    const amount = confirmed.totalAmount ?? 0;
    const dial = isMobileMoney && amount > 0 && !paidOnline
      ? buildMobileMoneyDial(paymentMethod as MobileMoneyMethod, amount)
      : null;

    return (
      <div className="container mx-auto px-4 py-12">
        <Seo path="/checkout" title="Order confirmed — DENISE Textile Rwanda" description="Your DENISE Textile order has been placed." />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">
              {tr('checkout.success_title', 'Order placed')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {tr('checkout.success_desc', 'We have your order. Our team confirms every order before it is prepared — you will hear from us by SMS.')}
            </p>
          </div>

          <div className={cn(card, 'mb-4')}>
            {/* The reference number is the whole identity of an order — QR codes
                were removed from the customer flow on main, so it is shown
                large and copyable instead. */}
            <p className="text-center text-2xl font-mono font-bold text-primary mb-4 select-all">
              {confirmed.reservationNumber}
            </p>

            <dl className="space-y-2 text-sm border-t border-border pt-4">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('payment.method')}</dt>
                <dd className="font-medium">{t(`payment.${paymentMethod || 'PAY_AT_SHOP'}`)}</dd>
              </div>
              {confirmed.subtotal != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tr('cart.subtotal', 'Subtotal')}</dt>
                  <dd>{money(confirmed.subtotal)}</dd>
                </div>
              )}
              {!!confirmed.deliveryFee && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><EditableText id="delivery.fee" /></dt>
                  <dd>{money(confirmed.deliveryFee)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <dt className="font-semibold">{tr('checkout.grand_total', 'Grand total')}</dt>
                <dd className="font-bold text-primary">
                  {amount > 0 ? money(amount) : tr('checkout.to_be_confirmed', 'To be confirmed')}
                </dd>
              </div>
            </dl>
          </div>

          {/* What happens next — different for every payment route, and the
              single most common support question. */}
          <div className={cn(card, 'mb-4 bg-primary/5 border-primary/20')}>
            <h2 className="font-semibold mb-2 text-sm">{tr('checkout.next_title', 'What happens next')}</h2>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>{tr('checkout.next_confirm', 'Our team reviews and confirms your order.')}</li>
              {dial
                ? <li>{tr('checkout.next_pay_momo', 'Pay with Mobile Money using the button below, or from Track Order at any time.')}</li>
                : paymentMethod === 'BANK_TRANSFER'
                  ? <li>{tr('checkout.next_bank', 'We send you our bank details for the transfer.')}</li>
                  : <li>{tr('checkout.next_pay_person', 'You pay in person — nothing is charged online.')}</li>}
              <li>{tr('checkout.next_prepare', 'We prepare your order and keep you updated at every step.')}</li>
            </ol>
          </div>

          {dial && (
            <div className={cn(card, 'mb-4 text-center border-2 border-primary/30')}>
              <EditableText id="reservation.pay_now" as="h2" className="font-semibold mb-1" />
              <EditableText id="reservation.pay_momo_instructions" as="p" className="text-sm text-muted-foreground mb-4" />
              <a
                href={dial.href}
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Smartphone size={18} /> <EditableText id="reservation.pay_dial" /> {dial.label} · {money(amount)}
              </a>
              <p className="text-xs text-muted-foreground mt-3">
                <EditableText id="reservation.pay_iphone_hint" />{' '}
                <span className="font-mono font-semibold select-all">{dial.ussd}</span>
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to={`/track?ref=${confirmed.reservationNumber}`}
              className="flex-1 text-center py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              <EditableText id="reservation.track_order" />
            </Link>
            <Link
              to="/products"
              className="flex-1 text-center py-3 border border-border font-medium rounded-xl hover:bg-accent transition-colors"
            >
              <EditableText id="reservation.continue_shopping" />
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="container mx-auto px-4 py-8">
      <Seo
        path="/checkout"
        title="Checkout — DENISE Textile Rwanda"
        description="Confirm your delivery details, review your order and choose how to pay."
      />

      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: t('nav.cart'), to: '/cart' },
          { label: tr('checkout.title', 'Checkout') },
        ]} />

        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-1">
          {tr('checkout.title', 'Checkout')}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {tr('checkout.subtitle', 'Delivery details first, then review, then payment.')}
        </p>

        {/* Progress */}
        <ol className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s.id} className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { if (done) setStep(s.id); }}
                  disabled={!done}
                  className={cn(
                    'flex items-center gap-2 rounded-full transition-colors',
                    done && 'cursor-pointer hover:opacity-80',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    active ? 'bg-primary text-primary-foreground'
                      : done ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}>
                    {done ? <Check size={13} /> : i + 1}
                  </span>
                  <span className={cn('text-sm font-medium whitespace-nowrap', !active && !done && 'text-muted-foreground')}>
                    {tr(s.labelKey, s.fallback)}
                  </span>
                </button>
                {i < STEPS.length - 1 && <ChevronRight size={14} className="text-muted-foreground" />}
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-5">

            {/* ── STEP 1 · DELIVERY INFORMATION ──────────────────────────── */}
            {step === 'delivery' && (
              <form
                onSubmit={(e) => { e.preventDefault(); setStep('review'); }}
                className="space-y-5"
              >
                <fieldset className={card}>
                  <legend className="font-semibold mb-4 flex items-center gap-2">
                    <Truck size={16} className="text-primary" />
                    {tr('checkout.how_receive', 'How would you like to receive your order?')}
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {FULFILLMENT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const selected = fulfillmentType === option.type;
                      return (
                        <label
                          key={option.type}
                          className={cn(
                            'flex flex-col gap-1.5 p-4 border-2 rounded-xl cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary/40',
                            selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                          )}
                        >
                          <input
                            type="radio" name="fulfillment" value={option.type} checked={selected}
                            onChange={() => setFulfillmentType(option.type)} className="sr-only"
                          />
                          <Icon size={18} className="text-primary" />
                          <span className="font-medium text-sm">{t(option.titleKey)}</span>
                          <span className="text-xs text-muted-foreground leading-snug">{t(option.descKey)}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Contact */}
                <fieldset className={card}>
                  <legend className="font-semibold mb-4 flex items-center gap-2">
                    <User size={16} className="text-primary" /> <EditableText id="reservation.contact_info" />
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="co-name" className="text-sm font-medium block mb-1.5">
                        <EditableText id="reservation.customer_name" /> *
                      </label>
                      <div className="relative">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          id="co-name" required value={form.customerName} autoComplete="name"
                          onChange={(e) => update('customerName', e.target.value)}
                          placeholder={t('reservation.name_placeholder')}
                          className={cn(field, 'pl-9')}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="co-phone" className="text-sm font-medium block mb-1.5">
                        <EditableText id="reservation.phone" /> *
                      </label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          id="co-phone" required type="tel" autoComplete="tel" value={form.customerPhone}
                          onChange={(e) => update('customerPhone', e.target.value)}
                          placeholder="+250 780 000 000" className={cn(field, 'pl-9')}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="co-email" className="text-sm font-medium block mb-1.5">
                        <EditableText id="reservation.email" />
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          id="co-email" type="email" autoComplete="email" value={form.customerEmail}
                          onChange={(e) => update('customerEmail', e.target.value)}
                          placeholder="jean@example.com" className={cn(field, 'pl-9')}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="co-lang" className="text-sm font-medium block mb-1.5">
                        <EditableText id="reservation.language" />
                      </label>
                      <select
                        id="co-lang" value={form.preferredLanguage}
                        onChange={(e) => update('preferredLanguage', e.target.value)} className={field}
                      >
                        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* Delivery address */}
                {isDelivery && (
                  <fieldset className={card}>
                    <legend className="font-semibold mb-4 flex items-center gap-2">
                      <MapPin size={16} className="text-primary" /> <EditableText id="delivery.address" />
                    </legend>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
                      {DELIVERY_TYPES.map((dt) => (
                        <label
                          key={dt.type}
                          className={cn(
                            'p-3 border-2 rounded-xl text-center text-xs cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary/40',
                            form.deliveryType === dt.type ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40',
                          )}
                        >
                          <input
                            type="radio" name="deliveryType" value={dt.type}
                            checked={form.deliveryType === dt.type}
                            onChange={() => update('deliveryType', dt.type)} className="sr-only"
                          />
                          <span className="font-semibold block mb-0.5">{t(dt.labelKey)}</span>
                          <span className="text-muted-foreground block">{t(dt.descKey)}</span>
                          <span className="font-medium block mt-1">{t(dt.extraKey)}</span>
                        </label>
                      ))}
                    </div>

                    {form.deliveryType === 'SCHEDULED' && (
                      <div className="mb-4">
                        <label htmlFor="co-scheduled" className="text-sm font-medium block mb-1.5">
                          <EditableText id="reservation.scheduled_date" /> *
                        </label>
                        <input
                          id="co-scheduled" required type="date" min={minDate} value={form.scheduledDate}
                          onChange={(e) => update('scheduledDate', e.target.value)} className={field}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="co-province" className="text-sm font-medium block mb-1.5">
                          <EditableText id="delivery.province" /> *
                        </label>
                        <select
                          id="co-province" required value={form.province}
                          onChange={(e) => { update('province', e.target.value); update('district', ''); }}
                          className={field}
                        >
                          <option value="">{t('reservation.select_province')}</option>
                          {RWANDA_PROVINCES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="co-district" className="text-sm font-medium block mb-1.5">
                          <EditableText id="delivery.district" /> *
                        </label>
                        <select
                          id="co-district" required value={form.district} disabled={!form.province}
                          onChange={(e) => update('district', e.target.value)}
                          className={cn(field, 'disabled:opacity-50')}
                        >
                          <option value="">{t('reservation.select_district')}</option>
                          {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="co-sector" className="text-sm font-medium block mb-1.5">
                          <EditableText id="delivery.sector" />
                        </label>
                        <input
                          id="co-sector" value={form.sector} onChange={(e) => update('sector', e.target.value)}
                          placeholder={t('reservation.sector_placeholder')} className={field}
                        />
                      </div>
                      <div>
                        <label htmlFor="co-cell" className="text-sm font-medium block mb-1.5">
                          <EditableText id="delivery.cell" />
                        </label>
                        <input
                          id="co-cell" value={form.cell} onChange={(e) => update('cell', e.target.value)}
                          placeholder={t('reservation.cell_placeholder')} className={field}
                        />
                      </div>
                      <div>
                        <label htmlFor="co-village" className="text-sm font-medium block mb-1.5">
                          <EditableText id="delivery.village" />
                        </label>
                        <input
                          id="co-village" value={form.village} onChange={(e) => update('village', e.target.value)}
                          className={field}
                        />
                      </div>
                      <div>
                        <label htmlFor="co-street" className="text-sm font-medium block mb-1.5">
                          <EditableText id="delivery.street" /> *
                        </label>
                        <input
                          id="co-street" required value={form.streetAddress}
                          onChange={(e) => update('streetAddress', e.target.value)}
                          placeholder={t('reservation.street_placeholder')} className={field}
                        />
                      </div>
                    </div>

                    {form.province && (
                      <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm flex items-center justify-between gap-3">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Truck size={14} className="text-primary" />
                          {t('delivery.fee_for', { province: form.province })}
                        </span>
                        <span className="font-bold text-primary">{money(deliveryFee)}</span>
                      </div>
                    )}
                  </fieldset>
                )}

                {/* Shop visit */}
                {isReservation && (
                  <>
                    <fieldset className={card}>
                      <legend className="font-semibold mb-4 flex items-center gap-2">
                        <Calendar size={16} className="text-primary" /> <EditableText id="reservation.schedule_visit" />
                      </legend>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="co-date" className="text-sm font-medium block mb-1.5">
                            <EditableText id="reservation.date" /> *
                          </label>
                          <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                              id="co-date" required type="date" min={minDate} value={form.visitDate}
                              onChange={(e) => update('visitDate', e.target.value)} className={cn(field, 'pl-9')}
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="co-time" className="text-sm font-medium block mb-1.5">
                            <EditableText id="reservation.time" /> *
                          </label>
                          <div className="relative">
                            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <select
                              id="co-time" required value={form.visitTime}
                              onChange={(e) => update('visitTime', e.target.value)} className={cn(field, 'pl-9')}
                            >
                              <option value="">{t('reservation.select_time')}</option>
                              {timeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </fieldset>

                    <fieldset className={card}>
                      <legend className="font-semibold mb-4">
                        <EditableText id="reservation.measurement_option" />
                      </legend>
                      <div className="space-y-3">
                        {([
                          { value: 'KNOW_MEASUREMENTS', label: t('reservation.know_measurements'), desc: t('reservation.know_desc') },
                          { value: 'HELP_AT_SHOP', label: t('reservation.help_at_shop'), desc: t('reservation.help_desc') },
                          { value: 'WALK_IN_CONSULTATION', label: t('reservation.walk_in'), desc: t('reservation.walk_desc') },
                        ] as const).map((option) => (
                          <label
                            key={option.value}
                            className={cn(
                              'flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary/40',
                              form.measurementOption === option.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                            )}
                          >
                            <input
                              type="radio" name="measurement" value={option.value}
                              checked={form.measurementOption === option.value}
                              onChange={(e) => update('measurementOption', e.target.value)}
                              className="mt-0.5 accent-primary"
                            />
                            <span>
                              <span className="font-medium text-sm block">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.desc}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}

                {/* Notes */}
                <div className={card}>
                  <label htmlFor="co-notes" className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare size={16} className="text-primary" />
                    {isDelivery ? tr('checkout.delivery_notes', 'Delivery notes') : t('reservation.notes')}
                  </label>
                  <textarea
                    id="co-notes" rows={3} value={form.notes} maxLength={1000}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder={isDelivery ? t('reservation.notes_delivery_placeholder') : t('reservation.notes_placeholder')}
                    className={cn(field, 'resize-none')}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/cart"
                    className="sm:w-auto text-center px-6 py-3 border border-border rounded-xl font-medium hover:bg-accent transition-colors"
                  >
                    ← {tr('checkout.back_to_cart', 'Back to cart')}
                  </Link>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    {tr('checkout.to_review', 'Review your order')} <ChevronRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 2 · REVIEW ────────────────────────────────────────── */}
            {step === 'review' && (
              <div className="space-y-5">
                <section className={card}>
                  <header className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold">{tr('checkout.your_items', 'Your items')} ({items.length})</h2>
                    <Link to="/cart" className="text-xs font-medium text-primary hover:underline">
                      {t('common.edit')}
                    </Link>
                  </header>
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
                      <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <LineSummary item={item} />
                      </li>
                    ))}
                  </ul>
                </section>

                <section className={card}>
                  <header className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold">
                      {isDelivery ? t('delivery.address') : isReservation ? t('reservation.schedule_visit') : tr('checkout.collection', 'Collection')}
                    </h2>
                    <button
                      type="button" onClick={() => setStep('delivery')}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t('common.edit')}
                    </button>
                  </header>
                  <dl className="text-sm space-y-1.5">
                    <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">{t('reservation.customer_name')}</dt><dd className="font-medium">{form.customerName}</dd></div>
                    <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">{t('reservation.phone')}</dt><dd className="font-medium">{form.customerPhone}</dd></div>
                    {form.customerEmail && (
                      <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Email</dt><dd className="font-medium break-all">{form.customerEmail}</dd></div>
                    )}
                    {isDelivery && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-24 shrink-0">{t('delivery.address')}</dt>
                        <dd className="font-medium">
                          {[form.streetAddress, form.village, form.cell, form.sector, form.district, form.province].filter(Boolean).join(', ')}
                        </dd>
                      </div>
                    )}
                    {isReservation && form.visitDate && (
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-24 shrink-0">{t('reservation.visit_date')}</dt>
                        <dd className="font-medium">{form.visitDate} {form.visitTime}</dd>
                      </div>
                    )}
                    {form.notes && (
                      <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">{t('reservation.notes')}</dt><dd>{form.notes}</dd></div>
                    )}
                  </dl>
                </section>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button" onClick={() => setStep('delivery')}
                    className="sm:w-auto px-6 py-3 border border-border rounded-xl font-medium hover:bg-accent transition-colors"
                  >
                    ← {t('common.back')}
                  </button>
                  <button
                    type="button" onClick={() => setStep('payment')}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    {tr('checkout.to_payment', 'Continue to payment')} <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3 · PAYMENT ───────────────────────────────────────── */}
            {step === 'payment' && (
              <form
                onSubmit={(e) => { e.preventDefault(); placeOrder(); }}
                className="space-y-5"
              >
                <fieldset className={card}>
                  <legend className="font-semibold mb-1 flex items-center gap-2">
                    <CreditCard size={16} className="text-primary" /> <EditableText id="payment.method" />
                  </legend>
                  <p className="text-xs text-muted-foreground mb-4">
                    {tr('checkout.payment_intro', 'Choose how you would like to pay. Nothing is charged until you confirm.')}
                  </p>

                  <div className="space-y-2">
                    {paymentOptions.map((option) => {
                      const Icon = option.icon;
                      const selected = paymentMethod === option.method;
                      return (
                        <label
                          key={option.method}
                          className={cn(
                            'flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary/40',
                            selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                          )}
                        >
                          <input
                            type="radio" name="paymentMethod" value={option.method} checked={selected}
                            onChange={() => setPaymentMethod(option.method)}
                            className="mt-1 accent-primary"
                          />
                          <Icon size={18} className="text-primary mt-0.5 shrink-0" />
                          <span className="min-w-0">
                            <span className="font-medium text-sm block">{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.hint}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {isMobileMoney && (
                    <div className="mt-4">
                      <label htmlFor="co-momo" className="text-sm font-medium block mb-1.5">
                        <EditableText id="payment.mobile_money_phone" /> *
                      </label>
                      <input
                        id="co-momo" required type="tel" value={form.mobileMoneyPhone}
                        onChange={(e) => update('mobileMoneyPhone', e.target.value)}
                        placeholder="+250 780 000 000" className={field}
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        <EditableText id="payment.mobile_prompt" />
                      </p>
                    </div>
                  )}

                  <p className="mt-4 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground flex items-start gap-2">
                    <ShieldCheck size={14} className="text-primary shrink-0 mt-px" />
                    <EditableText id="payment.secure" as="span" />
                  </p>
                </fieldset>

                {createMutation.isError && (
                  <p className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive" role="alert">
                    <AlertCircle size={16} className="shrink-0 mt-px" />
                    <span>
                      {tr('checkout.error_detail', 'Your order was not placed and nothing was charged. Your cart is exactly as you left it — please try again.')}
                    </span>
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button" onClick={() => setStep('review')} disabled={createMutation.isPending}
                    className="sm:w-auto px-6 py-3 border border-border rounded-xl font-medium hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    ← {t('common.back')}
                  </button>
                  <button
                    type="submit"
                    disabled={!paymentMethod || createMutation.isPending || placedRef.current}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? (
                      <><Loader2 size={17} className="animate-spin" /> {t('reservation.processing')}</>
                    ) : (
                      <>
                        {grandTotal > 0
                          ? tr('checkout.place_order_amount', 'Place order · {{amount}}', { amount: money(grandTotal) })
                          : t('reservation.place_order')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── Summary rail ───────────────────────────────────────────────── */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className={card}>
              <EditableText id="reservation.order_summary" as="h2" className="font-semibold mb-4" />

              <ul className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id}><LineSummary item={item} compact /></li>
                ))}
              </ul>

              <dl className="space-y-2 text-sm border-t border-border pt-3">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{tr('cart.subtotal', 'Subtotal')}</dt>
                  <dd>{money(goods)}</dd>
                </div>
                {saved > 0 && (
                  <div className="flex justify-between text-green-700 dark:text-green-400">
                    <dt>{tr('cart.discount', 'Discount')}</dt>
                    <dd>−{money(saved)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground"><EditableText id="delivery.fee" /></dt>
                  <dd>
                    {isDelivery
                      ? (form.province ? money(deliveryFee) : <span className="text-xs text-muted-foreground">{tr('checkout.pick_province', 'Choose a province')}</span>)
                      : <span className="text-xs text-muted-foreground">{tr('checkout.no_delivery', 'Not applicable')}</span>}
                  </dd>
                </div>
                <div className="flex justify-between items-baseline border-t border-border pt-3">
                  <dt className="font-semibold">{tr('checkout.grand_total', 'Grand total')}</dt>
                  <dd className="text-xl font-bold text-primary">{money(grandTotal)}</dd>
                </div>
              </dl>

              {hasQuotedItems() && (
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  {tr('cart.quote_note', 'Some items are priced on request. Our team confirms the final price before you pay anything.')}
                </p>
              )}
            </div>

            {isReservation && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-sm">
                <p className="font-medium mb-1 text-green-800 dark:text-green-200">
                  💡 <EditableText id="reservation.no_online_payment" />
                </p>
                <p className="text-green-700 dark:text-green-300 text-xs">
                  <EditableText id="reservation.no_online_payment_desc" />
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
