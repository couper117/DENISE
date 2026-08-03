import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, Calendar, Clock, User, Phone, Mail, MessageSquare,
  CheckCircle2, QrCode, MapPin, Truck, Store, ShoppingBag,
  CreditCard, Smartphone, ChevronRight,
} from 'lucide-react';
import QRCode from 'qrcode.react';
import { useCartStore } from '../store';
import { reservationsApi } from '../lib/api';
import { Reservation, FulfillmentType, PaymentMethod, DeliveryType } from '../types';
import { generateTimeSlots, getMinReservationDate } from '../lib/utils';
import FabricEstimator from '../components/reservation/FabricEstimator';
import Seo from '../components/Seo';
import { RWANDA_PROVINCES, getDistrictsForProvince, getDeliveryFee } from '../lib/rwanda';
import { AIRTEL_ENABLED } from '../lib/config';
import { cn } from '../lib/utils';
import { EditableText } from '../cms';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ln', label: 'Lingala' },
];

const FULFILLMENT_OPTIONS: {
  type: FulfillmentType;
  icon: string;
  titleKey: string;
  descKey: string;
  badgeKey: string;
  accent: string;
}[] = [
  {
    type: 'RESERVATION',
    icon: '🏪',
    titleKey: 'fulfillment.RESERVATION',
    descKey: 'fulfillment.reserve_desc',
    badgeKey: 'fulfillment.reserve_badge',
    accent: 'border-brand-green bg-green-50 dark:bg-green-950/20',
  },
  {
    type: 'PICKUP',
    icon: '📦',
    titleKey: 'fulfillment.PICKUP',
    descKey: 'fulfillment.pickup_desc',
    badgeKey: 'fulfillment.pickup_badge',
    accent: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
  },
  {
    type: 'DELIVERY',
    icon: '🚚',
    titleKey: 'fulfillment.DELIVERY',
    descKey: 'fulfillment.delivery_desc',
    badgeKey: 'fulfillment.delivery_badge',
    accent: 'border-purple-500 bg-purple-50 dark:bg-purple-950/20',
  },
];

// Only mobile-money methods that actually work via USSD are offered. Cash is
// handled by the "Reserve & visit shop" flow (pay in person at the store).
const PAYMENT_METHODS: { method: PaymentMethod; logo: string }[] = [
  { method: 'MTN_MOMO', logo: '📱' },
  ...(AIRTEL_ENABLED ? [{ method: 'AIRTEL_MONEY' as PaymentMethod, logo: '📱' }] : []),
];

const DELIVERY_TYPES: { type: DeliveryType; labelKey: string; descKey: string; extraKey: string }[] = [
  { type: 'SAME_DAY', labelKey: 'delivery.SAME_DAY', descKey: 'delivery.same_day_note', extraKey: 'delivery.extra_same_day' },
  { type: 'NEXT_DAY', labelKey: 'delivery.NEXT_DAY', descKey: 'delivery.next_day_note', extraKey: 'delivery.extra_included' },
  { type: 'SCHEDULED', labelKey: 'delivery.SCHEDULED', descKey: 'delivery.scheduled_note', extraKey: 'delivery.extra_included' },
];

type Step = 'options' | 'cart' | 'form' | 'success';

const ReservationPage = () => {
  const { t } = useTranslation();
  const { items, removeItem, updateItem, clearCart } = useCartStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pre-select fulfillment type from ?mode= param (set by ProductDetail purchase buttons)
  const modeParam = searchParams.get('mode') as FulfillmentType | null;
  const validModes: FulfillmentType[] = ['RESERVATION', 'PICKUP', 'DELIVERY'];
  const initialMode: FulfillmentType = modeParam && validModes.includes(modeParam) ? modeParam : 'RESERVATION';
  const initialStep: Step = modeParam && validModes.includes(modeParam) ? 'cart' : 'options';

  const [step, setStep] = useState<Step>(initialStep);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(initialMode);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    preferredLanguage: 'en',
    visitDate: '',
    visitTime: '',
    notes: '',
    measurementOption: 'HELP_AT_SHOP',
    paymentMethod: '' as PaymentMethod | '',
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

  const update = (key: keyof typeof form, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const timeSlots = generateTimeSlots();
  const minDate = getMinReservationDate();

  const deliveryFee = useMemo(
    () => (fulfillmentType === 'DELIVERY' && form.province ? getDeliveryFee(form.province) : 0),
    [fulfillmentType, form.province]
  );

  const extraDeliveryFee = fulfillmentType === 'DELIVERY' && form.deliveryType === 'SAME_DAY' ? 1000 : 0;
  const totalDeliveryFee = deliveryFee + extraDeliveryFee;

  const districtOptions = useMemo(
    () => getDistrictsForProvince(form.province),
    [form.province]
  );

  const isMobileMoney = form.paymentMethod === 'MTN_MOMO' || form.paymentMethod === 'AIRTEL_MONEY';
  const requiresPayment = fulfillmentType === 'PICKUP' || fulfillmentType === 'DELIVERY';

  const selectedOption = FULFILLMENT_OPTIONS.find((o) => o.type === fulfillmentType);
  const selectedTitle = t(selectedOption?.titleKey || 'fulfillment.RESERVATION');

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      reservationsApi.create(data).then((r) => r.data.data as Reservation),
    onSuccess: (data) => {
      setConfirmedReservation(data);
      clearCart();
      setStep('success');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const deliveryAddress =
      fulfillmentType === 'DELIVERY'
        ? {
            province: form.province,
            district: form.district,
            sector: form.sector || undefined,
            cell: form.cell || undefined,
            village: form.village || undefined,
            streetAddress: form.streetAddress || undefined,
          }
        : undefined;

    const payload = {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail || undefined,
      preferredLanguage: form.preferredLanguage,
      fulfillmentType,
      visitDate: fulfillmentType === 'RESERVATION' ? form.visitDate : undefined,
      visitTime: fulfillmentType === 'RESERVATION' ? form.visitTime : undefined,
      notes: form.notes || undefined,
      measurementOption: fulfillmentType === 'RESERVATION' ? form.measurementOption : 'HELP_AT_SHOP',
      paymentMethod: requiresPayment ? form.paymentMethod || undefined : 'PAY_AT_SHOP',
      mobileMoneyPhone: isMobileMoney ? form.mobileMoneyPhone : undefined,
      deliveryType: fulfillmentType === 'DELIVERY' ? form.deliveryType : undefined,
      deliveryAddress,
      scheduledDeliveryDate:
        fulfillmentType === 'DELIVERY' && form.deliveryType === 'SCHEDULED'
          ? form.scheduledDate
          : undefined,
      items: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity ?? null,
        metersRequired: item.metersRequired ?? null,
        windowWidth: item.windowWidth ?? null,
        windowHeight: item.windowHeight ?? null,
        notes: item.notes ?? null,
      })),
    };

    createMutation.mutate(payload);
  };

  // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
  if (step === 'success' && confirmedReservation) {
    const isDelivery = confirmedReservation.fulfillmentType === 'DELIVERY';
    const isPickup = confirmedReservation.fulfillmentType === 'PICKUP';
    const payAmount = confirmedReservation.totalAmount ?? 0;
    // Payment happens AFTER an admin confirms the order — the customer gets the
    // MoMo/Airtel dial prompt on the Track Order page once the status leaves PENDING.
    const awaitingMomoPayment = (form.paymentMethod === 'MTN_MOMO' || form.paymentMethod === 'AIRTEL_MONEY') && payAmount > 0;
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h1 className="font-serif text-3xl font-bold mb-2">
            {isDelivery ? t('reservation.order_placed') : isPickup ? t('reservation.order_confirmed') : t('reservation.success_title')}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isDelivery
              ? t('reservation.success_delivery')
              : isPickup
              ? t('reservation.success_pickup')
              : t('reservation.success_message')}
          </p>

          <div className="bg-card border border-border rounded-2xl p-6 text-left mb-6">
            <div className="text-3xl font-mono font-bold text-primary text-center mb-4">
              {confirmedReservation.reservationNumber}
            </div>

            {confirmedReservation.qrCode && (
              <div className="flex justify-center mb-5">
                <div className="p-4 bg-white rounded-xl border border-border">
                  <QRCode value={confirmedReservation.reservationNumber} size={140} />
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {isPickup ? t('reservation.show_pickup') : t('reservation.show_shop')}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground"><EditableText id="reservation.type_label" />:</span>
                <span className="font-medium capitalize">
                  {confirmedReservation.fulfillmentType === 'DELIVERY'
                    ? t('reservation.type_delivery')
                    : confirmedReservation.fulfillmentType === 'PICKUP'
                    ? t('reservation.type_pickup')
                    : t('reservation.type_shop_visit')}
                </span>
              </div>
              {confirmedReservation.visitDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><EditableText id="reservation.visit_date" />:</span>
                  <span className="font-medium">
                    {new Date(confirmedReservation.visitDate).toLocaleDateString('en-RW', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {confirmedReservation.deliveryAddress && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><EditableText id="reservation.deliver_to" />:</span>
                  <span className="font-medium text-right max-w-[60%]">
                    {confirmedReservation.deliveryAddress.district},{' '}
                    {confirmedReservation.deliveryAddress.province}
                  </span>
                </div>
              )}
              {confirmedReservation.totalAmount && (
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="font-semibold"><EditableText id="reservation.total_paid" />:</span>
                  <span className="font-bold text-primary">
                    {confirmedReservation.totalAmount.toLocaleString()} <EditableText id="common.rwf" />
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground"><EditableText id="reservation.status" />:</span>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                  <EditableText id="reservation.pending_confirmation" />
                </span>
              </div>
            </div>
          </div>

          {awaitingMomoPayment && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-6 text-center">
              <EditableText id="reservation.pay_after_confirm_title" as="p" className="font-medium text-blue-800 dark:text-blue-200 mb-1" />
              <EditableText id="reservation.pay_after_confirm_desc" as="p" className="text-blue-700 dark:text-blue-300 text-xs" />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to={`/track?ref=${confirmedReservation.reservationNumber}`}
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

  return (
    <div className="container mx-auto px-4 py-8">
      <Seo
        path="/reservation"
        title="Reserve or Order Online — DENISE Textile Kigali"
        description="Reserve products and visit our Kigali shop, or buy online with delivery anywhere in Rwanda. Curtains, fabrics and traditional attire from DENISE."
      />
      <div className="max-w-5xl mx-auto">
        <EditableText id="reservation.title" as="h1" className="font-serif text-3xl font-bold mb-1" />
        <EditableText id="reservation.subtitle" as="p" className="text-muted-foreground mb-6" />

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          {(['options', 'cart', 'form'] as const).map((s, i) => {
            const labels = [t('reservation.step_method'), t('reservation.step_cart'), t('reservation.step_details')];
            const reached =
              step === 'options' ? i === 0 :
              step === 'cart' ? i <= 1 :
              true;
            return (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  step === s ? 'bg-primary text-white' : reached ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {i + 1}
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{labels[i]}</span>
                {i < 2 && <ChevronRight size={14} className="text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: CHOOSE FULFILLMENT TYPE ── */}
        {step === 'options' && (
          <div>
            <EditableText id="fulfillment.choose" as="h2" className="font-serif text-xl font-semibold mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {FULFILLMENT_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.type}
                  whileHover={{ y: -2 }}
                  onClick={() => setFulfillmentType(opt.type)}
                  className={cn(
                    'text-left p-6 border-2 rounded-2xl transition-all',
                    fulfillmentType === opt.type
                      ? opt.accent + ' border-current shadow-md'
                      : 'border-border hover:border-primary/40 bg-card'
                  )}
                >
                  <div className="text-4xl mb-3">{opt.icon}</div>
                  <h3 className="font-semibold text-base mb-2">{t(opt.titleKey)}</h3>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{t(opt.descKey)}</p>
                  <span className="inline-block text-xs font-medium px-3 py-1 bg-primary/10 text-primary rounded-full">
                    {t(opt.badgeKey)}
                  </span>
                </motion.button>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep('cart')}
                className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                {t('reservation.continue_with', { title: selectedTitle })}
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: CART ── */}
        {step === 'cart' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg"><EditableText id="reservation.cart_title" /> ({items.length})</h2>
                <span className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
                  {selectedOption?.icon}{' '}
                  {selectedTitle}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <div className="text-5xl mb-4">🛍️</div>
                  <EditableText id="reservation.cart_empty" as="p" className="font-medium mb-2" />
                  <Link
                    to="/products"
                    className="inline-block mt-3 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
                  >
                    <EditableText id="reservation.browse_products" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const img = item.product.images?.find((i) => i.isPrimary) || item.product.images?.[0];
                    return (
                      <div key={item.product.id} className="bg-card border border-border rounded-xl p-4">
                        <div className="flex gap-4">
                          <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden shrink-0">
                            {img ? (
                              <img src={img.url} alt={item.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">🧵</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm mb-0.5 truncate">{item.product.name}</h3>
                            <p className="text-xs text-muted-foreground mb-2">{item.product.category?.name}</p>
                            {item.product.price && (
                              <p className="text-sm font-semibold text-primary">
                                {item.product.price.toLocaleString()} {item.product.currency ?? 'RWF'}
                                {item.product.pricePerMeter && ' /m'}
                              </p>
                            )}
                            {fulfillmentType !== 'PICKUP' && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                  <EditableText id="reservation.quantity" as="label" className="text-xs text-muted-foreground" />
                                  <input
                                    type="number" min="1"
                                    value={item.quantity || ''}
                                    placeholder={t('reservation.qty_placeholder')}
                                    onChange={(e) => updateItem(item.product.id, { quantity: e.target.value ? parseInt(e.target.value) : undefined })}
                                    className="w-full mt-0.5 px-2 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                </div>
                                <div>
                                  <EditableText id="reservation.meters_optional" as="label" className="text-xs text-muted-foreground" />
                                  <input
                                    type="number" min="0.1" step="0.1"
                                    value={item.metersRequired || ''}
                                    placeholder={t('reservation.meters_placeholder')}
                                    onChange={(e) => updateItem(item.product.id, { metersRequired: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    className="w-full mt-0.5 px-2 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.product.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <FabricEstimator />
              <div className="bg-card border border-border rounded-xl p-5">
                <EditableText id="reservation.order_summary" as="h3" className="font-semibold mb-4" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><EditableText id="reservation.items_label" />:</span>
                    <span>{items.length}</span>
                  </div>
                  {fulfillmentType === 'DELIVERY' && form.province && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground"><EditableText id="delivery.fee" />:</span>
                      <span>{totalDeliveryFee.toLocaleString()} <EditableText id="common.rwf" /></span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setStep('options')}
                    className="flex-1 py-3 border border-border text-sm rounded-xl hover:bg-accent transition-colors"
                  >
                    ← <EditableText id="reservation.change_method" />
                  </button>
                  <button
                    disabled={items.length === 0}
                    onClick={() => setStep('form')}
                    className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <EditableText id="reservation.continue" /> →
                  </button>
                </div>
                {items.length === 0 && fulfillmentType === 'RESERVATION' && (
                  <button
                    onClick={() => setStep('form')}
                    className="w-full mt-2 py-2 border border-border text-sm rounded-xl hover:bg-accent transition-colors"
                  >
                    <EditableText id="reservation.book_consultation" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: DETAILS FORM ── */}
        {step === 'form' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">

              {/* Contact */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <User size={16} className="text-primary" /> <EditableText id="reservation.contact_info" />
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5"><EditableText id="reservation.customer_name" /> *</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input required value={form.customerName} onChange={(e) => update('customerName', e.target.value)}
                        placeholder={t('reservation.name_placeholder')}
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5"><EditableText id="reservation.phone" /> *</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input required value={form.customerPhone} onChange={(e) => update('customerPhone', e.target.value)}
                        placeholder="+250 780 000 000" type="tel"
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>
                  <div>
                    <EditableText id="reservation.email" as="label" className="text-sm font-medium block mb-1.5" />
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input value={form.customerEmail} onChange={(e) => update('customerEmail', e.target.value)}
                        placeholder="jean@example.com" type="email"
                        className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>
                  <div>
                    <EditableText id="reservation.language" as="label" className="text-sm font-medium block mb-1.5" />
                    <select value={form.preferredLanguage} onChange={(e) => update('preferredLanguage', e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Visit scheduling — only for RESERVATION type */}
              {fulfillmentType === 'RESERVATION' && (
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-primary" /> <EditableText id="reservation.schedule_visit" />
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5"><EditableText id="reservation.date" /> *</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input required type="date" min={minDate} value={form.visitDate}
                          onChange={(e) => update('visitDate', e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5"><EditableText id="reservation.time" /> *</label>
                      <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <select required value={form.visitTime} onChange={(e) => update('visitTime', e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                          <option value=""><EditableText id="reservation.select_time" /></option>
                          {timeSlots.map((ts) => <option key={ts} value={ts}>{ts}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery address — only for DELIVERY type */}
              {fulfillmentType === 'DELIVERY' && (
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <MapPin size={16} className="text-primary" /> <EditableText id="delivery.address" />
                  </h3>

                  {/* Delivery type */}
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {DELIVERY_TYPES.map((dt) => (
                      <button
                        key={dt.type}
                        type="button"
                        onClick={() => update('deliveryType', dt.type)}
                        className={cn(
                          'p-3 border-2 rounded-xl text-center text-xs transition-all',
                          form.deliveryType === dt.type
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        <div className="font-semibold mb-0.5">{t(dt.labelKey)}</div>
                        <div className="text-muted-foreground">{t(dt.descKey)}</div>
                        <div className="font-medium mt-1">{t(dt.extraKey)}</div>
                      </button>
                    ))}
                  </div>

                  {form.deliveryType === 'SCHEDULED' && (
                    <div className="mb-4">
                      <label className="text-sm font-medium block mb-1.5"><EditableText id="reservation.scheduled_date" /> *</label>
                      <input required type="date" min={minDate} value={form.scheduledDate}
                        onChange={(e) => update('scheduledDate', e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-1.5"><EditableText id="delivery.province" /> *</label>
                      <select required value={form.province}
                        onChange={(e) => { update('province', e.target.value); update('district', ''); }}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value=""><EditableText id="reservation.select_province" /></option>
                        {RWANDA_PROVINCES.map((p) => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1.5"><EditableText id="delivery.district" /> *</label>
                      <select required value={form.district} onChange={(e) => update('district', e.target.value)}
                        disabled={!form.province}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50">
                        <option value=""><EditableText id="reservation.select_district" /></option>
                        {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <EditableText id="delivery.sector" as="label" className="text-sm font-medium block mb-1.5" />
                      <input value={form.sector} onChange={(e) => update('sector', e.target.value)}
                        placeholder={t('reservation.sector_placeholder')}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <EditableText id="delivery.cell" as="label" className="text-sm font-medium block mb-1.5" />
                      <input value={form.cell} onChange={(e) => update('cell', e.target.value)}
                        placeholder={t('reservation.cell_placeholder')}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium block mb-1.5"><EditableText id="delivery.street" /> *</label>
                      <input required value={form.streetAddress} onChange={(e) => update('streetAddress', e.target.value)}
                        placeholder={t('reservation.street_placeholder')}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                  </div>

                  {form.province && (
                    <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Truck size={14} className="text-primary" />
                        {t('delivery.fee_for', { province: form.province })}
                      </span>
                      <span className="font-bold text-primary">
                        {totalDeliveryFee.toLocaleString()} <EditableText id="common.rwf" />
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment method — for PICKUP and DELIVERY */}
              {requiresPayment && (
                <div className="bg-card border border-border rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-primary" /> <EditableText id="payment.method" /> *
                  </h3>

                  {/* Mobile Money (MTN / Airtel) */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                      📱 <EditableText id="payment.group_mobile_money" />
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <label key={m.method}
                          className={cn(
                            'flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors',
                            form.paymentMethod === m.method
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/40'
                          )}
                        >
                          <input type="radio" name="payment" value={m.method}
                            checked={form.paymentMethod === m.method}
                            onChange={(e) => update('paymentMethod', e.target.value)}
                            className="accent-primary" />
                          <span className="text-xl">{m.logo}</span>
                          <span className="text-sm font-medium">{t(`payment.${m.method}`)}</span>
                        </label>
                      ))}
                    </div>
                    {isMobileMoney && (
                      <div className="mt-3">
                        <label className="text-sm font-medium block mb-1.5">
                          <Smartphone size={13} className="inline mr-1" />
                          <EditableText id="payment.mobile_money_phone" /> *
                        </label>
                        <input required value={form.mobileMoneyPhone}
                          onChange={(e) => update('mobileMoneyPhone', e.target.value)}
                          placeholder="+250 780 000 000" type="tel"
                          className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        <p className="text-xs text-muted-foreground mt-1">
                          <EditableText id="payment.mobile_prompt" />
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground flex items-start gap-2">
                    <span>🔒</span>
                    <EditableText id="payment.secure" as="span" />
                  </div>
                </div>
              )}

              {/* Measurement option — only for RESERVATION */}
              {fulfillmentType === 'RESERVATION' && (
                <div className="bg-card border border-border rounded-xl p-6">
                  <EditableText id="reservation.measurement_option" as="h3" className="font-semibold mb-4" />
                  <div className="space-y-3">
                    {([
                      { value: 'KNOW_MEASUREMENTS', label: t('reservation.know_measurements'), desc: t('reservation.know_desc') },
                      { value: 'HELP_AT_SHOP', label: t('reservation.help_at_shop'), desc: t('reservation.help_desc') },
                      { value: 'WALK_IN_CONSULTATION', label: t('reservation.walk_in'), desc: t('reservation.walk_desc') },
                    ] as const).map((opt) => (
                      <label key={opt.value}
                        className={cn(
                          'flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors',
                          form.measurementOption === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                        )}
                      >
                        <input type="radio" name="measurement" value={opt.value}
                          checked={form.measurementOption === opt.value}
                          onChange={(e) => update('measurementOption', e.target.value)}
                          className="mt-0.5 accent-primary" />
                        <div>
                          <div className="font-medium text-sm">{opt.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="bg-card border border-border rounded-xl p-6">
                <label className="font-semibold block mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-primary" /> <EditableText id="reservation.notes" />
                </label>
                <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)}
                  placeholder={
                    fulfillmentType === 'DELIVERY'
                      ? t('reservation.notes_delivery_placeholder')
                      : t('reservation.notes_placeholder')
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('cart')}
                  className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-accent transition-colors">
                  ← <EditableText id="common.back" />
                </button>
                <button type="submit"
                  disabled={createMutation.isPending || (requiresPayment && !form.paymentMethod)}
                  className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-70">
                  {createMutation.isPending
                    ? t('reservation.processing')
                    : fulfillmentType === 'RESERVATION'
                    ? t('reservation.submit')
                    : t('reservation.place_order')}
                </button>
              </div>

              {createMutation.error && (
                <EditableText id="reservation.submit_error" as="p" className="text-sm text-destructive text-center" />
              )}
            </form>

            {/* Summary sidebar */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <EditableText id="reservation.order_summary" as="h3" className="font-semibold mb-4" />
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><EditableText id="reservation.items_label" />:</span>
                    <span>{items.length}</span>
                  </div>
                  {fulfillmentType === 'DELIVERY' && form.province && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground"><EditableText id="delivery.fee" /> ({form.province}):</span>
                        <span>{deliveryFee.toLocaleString()} <EditableText id="common.rwf" /></span>
                      </div>
                      {extraDeliveryFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground"><EditableText id="reservation.same_day_surcharge" />:</span>
                          <span>+{extraDeliveryFee.toLocaleString()} <EditableText id="common.rwf" /></span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {items.map((item) => {
                  const img = item.product.images?.find((i) => i.isPrimary) || item.product.images?.[0];
                  return (
                    <div key={item.product.id} className="flex gap-2 mb-2">
                      <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden shrink-0">
                        {img && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.product.name}</p>
                        {item.product.price && (
                          <p className="text-xs text-primary">{item.product.price.toLocaleString()} <EditableText id="common.rwf" /></p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {fulfillmentType === 'RESERVATION' && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm">
                  <p className="font-medium mb-1 text-green-800 dark:text-green-200">💡 <EditableText id="reservation.no_online_payment" /></p>
                  <p className="text-green-700 dark:text-green-300 text-xs">
                    <EditableText id="reservation.no_online_payment_desc" />
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReservationPage;
