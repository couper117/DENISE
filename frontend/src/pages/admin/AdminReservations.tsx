import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Search, ChevronDown, Truck, Store, Package, X, Printer, FileText,
  CreditCard, Clock, Check, Loader2,
} from 'lucide-react';
import { reservationsApi } from '../../lib/api';
import { Reservation, ReservationItem } from '../../types';
import { formatDate, getStatusColor, getStatusLabel, cn } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OrderInvoice from '../../components/admin/OrderInvoice';
import { toast } from '../../components/ui/Toaster';

const ALL_STATUSES = [
  '', 'PENDING', 'CONFIRMED', 'PREPARING', 'PROCESSING',
  'PACKED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'COMPLETED', 'CANCELLED',
];

const PAYMENT_STATUSES = ['', 'AWAITING', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];

const FULFILLMENT_ICONS: Record<string, React.ReactNode> = {
  RESERVATION: <Store size={12} className="text-green-600" />,
  PICKUP: <Package size={12} className="text-blue-600" />,
  DELIVERY: <Truck size={12} className="text-purple-600" />,
};

const FULFILLMENT_LABEL_KEYS: Record<string, string> = {
  RESERVATION: 'admin.reservations.label_reserve',
  PICKUP: 'admin.reservations.label_pickup',
  DELIVERY: 'admin.reservations.label_delivery',
};

const PS_LABELS: Record<string, string> = {
  AWAITING: 'Awaiting', PENDING: 'Payment pending', COMPLETED: 'Paid', FAILED: 'Failed', REFUNDED: 'Refunded',
};
const PS_COLORS: Record<string, string> = {
  AWAITING: 'bg-yellow-100 text-yellow-800', PENDING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800', FAILED: 'bg-red-100 text-red-800', REFUNDED: 'bg-purple-100 text-purple-800',
};

const money = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value).toLocaleString()} RWF`;

/** Everything the workshop needs to actually make the item. */
const ItemSpecs = ({ item }: { item: ReservationItem }) => {
  const o = item.options ?? {};
  const chips: { label: string; value: string }[] = [];
  if (o.color) chips.push({ label: 'Colour', value: o.color });
  if (item.windowWidth) chips.push({ label: 'Width', value: `${item.windowWidth} cm` });
  if (item.windowHeight) chips.push({ label: 'Length', value: `${item.windowHeight} cm` });
  if (item.metersRequired) chips.push({ label: 'Fabric', value: `${item.metersRequired} m` });
  if (o.fullness) chips.push({ label: 'Fullness', value: `${o.fullness}×` });
  if (o.headerTypeLabel) chips.push({ label: 'Header', value: o.headerTypeLabel });
  if (o.liningLabel) chips.push({ label: 'Lining', value: o.liningLabel });
  if (o.panelLayoutLabel) chips.push({ label: 'Panels', value: o.panelLayoutLabel });
  if (o.fabric) chips.push({ label: 'Material', value: o.fabric });

  const image = item.product?.images?.find((i) => i.isPrimary) || item.product?.images?.[0];

  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-0">
      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
        {image && <img src={image.url} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.product?.name ?? item.options?.productName ?? 'Item'}</p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {chips.map((chip) => (
              <span key={chip.label} className="text-xs text-muted-foreground">
                {chip.label}: <span className="text-foreground font-medium">{chip.value}</span>
              </span>
            ))}
          </div>
        )}
        {item.notes && <p className="text-xs text-muted-foreground italic mt-1">“{item.notes}”</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">× {item.quantity ?? 1}</p>
        <p className="text-xs text-muted-foreground">{money(item.unitPrice)}</p>
        <p className="text-sm font-semibold text-primary">{money(item.totalPrice)}</p>
      </div>
    </div>
  );
};

const AdminReservations = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [amount, setAmount] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reservations', { search, status, fulfillmentFilter, paymentFilter, page }],
    queryFn: () =>
      reservationsApi.getAll({
        search: search || undefined,
        status: status || undefined,
        fulfillmentType: fulfillmentFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        page,
        limit: 20,
      }).then((r) => r.data),
  });

  const reservations: Reservation[] = data?.data || [];
  const pagination = data?.pagination;

  // The drawer renders from the list, so after any mutation it has to pick up
  // the refreshed row — otherwise the admin sees stale specs and totals.
  useEffect(() => {
    if (!selected) return;
    const fresh = reservations.find((r) => r.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [reservations]);

  const openOrder = (order: Reservation) => {
    setSelected(order);
    setNewStatus(order.status);
    setAdminNotes(order.adminNotes || '');
    setAmount(order.totalAmount != null ? String(order.totalAmount) : '');
    setShowInvoice(false);
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, adminNotes, totalAmount }: { id: string; status: string; adminNotes?: string; totalAmount?: string }) =>
      reservationsApi.updateStatus(id, { status, adminNotes, ...(totalAmount !== undefined && totalAmount !== '' ? { totalAmount } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
      toast({ title: t('admin.reservations.update_status'), variant: 'success' });
      setSelected(null);
    },
    onError: () => toast({ title: t('common.error'), variant: 'error' }),
  });

  // Mark payment paid/unpaid without closing the drawer, so the admin sees it flip.
  const paymentMutation = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: string }) =>
      reservationsApi.updateStatus(id, { paymentStatus }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
      setSelected((s) => (s ? { ...s, paymentStatus: vars.paymentStatus as Reservation['paymentStatus'] } : s));
    },
    onError: () => toast({ title: t('common.error'), variant: 'error' }),
  });

  const selectMenu = 'appearance-none px-4 py-2.5 pr-8 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.reservations.title')}</h1>
        <span className="text-sm text-muted-foreground">{pagination?.total || 0} {t('admin.total')}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.reservations.search')}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="relative">
          <select value={fulfillmentFilter} onChange={(e) => { setFulfillmentFilter(e.target.value); setPage(1); }} className={selectMenu}>
            <option value="">{t('admin.reservations.all_types')}</option>
            <option value="RESERVATION">{t('admin.reservations.type_reservations')}</option>
            <option value="PICKUP">{t('admin.reservations.type_pickup')}</option>
            <option value="DELIVERY">{t('admin.reservations.type_delivery')}</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectMenu}>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s ? getStatusLabel(s) : t('admin.reservations.all_statuses')}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }} className={selectMenu}>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? PS_LABELS[s] : t('admin.orders.all_payments', { defaultValue: 'Any payment status' })}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {[
                    t('admin.reservations.col_reference'),
                    t('admin.reservations.col_customer'),
                    t('admin.reservations.col_type'),
                    t('admin.reservations.col_date_address'),
                    t('admin.reservations.col_items'),
                    t('admin.reservations.total_amount'),
                    t('admin.reservations.payment'),
                    t('admin.status'),
                    t('admin.actions'),
                  ].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reservations.map((r) => {
                  const payment = r.payments?.[0];
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-primary text-xs">{r.reservationNumber}</span>
                        <span className="block text-[11px] text-muted-foreground">{formatDate(r.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {r.customerName[0]}
                          </div>
                          <div>
                            <p className="font-medium">{r.customerName}</p>
                            <p className="text-xs text-muted-foreground">{r.customerPhone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {FULFILLMENT_ICONS[r.fulfillmentType]}
                          <span className="text-xs">{FULFILLMENT_LABEL_KEYS[r.fulfillmentType] ? t(FULFILLMENT_LABEL_KEYS[r.fulfillmentType]) : r.fulfillmentType}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.fulfillmentType === 'DELIVERY' && r.deliveryAddress
                          ? `${r.deliveryAddress.district}, ${r.deliveryAddress.province}`
                          : r.visitDate
                            ? `${formatDate(r.visitDate)}${r.visitTime ? ` • ${r.visitTime}` : ''}`
                            : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-muted rounded-full text-xs whitespace-nowrap">
                          {r.items?.length || 0} {t('admin.reservations.items_count')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{money(r.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap', PS_COLORS[r.paymentStatus] || 'bg-muted')}>
                          {PS_LABELS[r.paymentStatus] || r.paymentStatus}
                        </span>
                        {payment && (
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {payment.method.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 text-xs rounded-full border font-medium whitespace-nowrap', getStatusColor(r.status))}>
                          {getStatusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openOrder(r)}
                          className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                        >
                          {t('admin.reservations.manage')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {reservations.length === 0 && (
            <p className="text-center text-muted-foreground py-10">{t('admin.reservations.no_orders')}</p>
          )}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 border border-border rounded-lg text-sm disabled:opacity-50 hover:bg-accent transition-colors">{t('admin.prev')}</button>
          <span className="px-4 py-2 text-sm">{page} / {pagination.totalPages}</span>
          <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 border border-border rounded-lg text-sm disabled:opacity-50 hover:bg-accent transition-colors">{t('admin.next')}</button>
        </div>
      )}

      {/* ── Manage drawer ──────────────────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.reservations.manage_order')}
        >
          <div className="bg-card border border-border w-full sm:max-w-3xl sm:rounded-2xl shadow-xl my-0 sm:my-8 max-h-screen sm:max-h-[90vh] overflow-y-auto">
            <header className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between gap-3 z-10 no-print">
              <div>
                <h2 className="font-semibold">{t('admin.reservations.manage_order')}</h2>
                <p className="text-xs text-muted-foreground font-mono">{selected.reservationNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoice((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  <FileText size={13} /> {t('admin.orders.invoice', { defaultValue: 'Invoice' })}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={t('admin.cancel')}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {showInvoice ? (
              <div className="p-4 sm:p-5">
                <div className="border border-border rounded-xl overflow-hidden mb-4">
                  <OrderInvoice order={selected} />
                </div>
                <div className="flex gap-3 no-print">
                  <button
                    type="button"
                    onClick={() => setShowInvoice(false)}
                    className="flex-1 py-2.5 border border-border rounded-xl text-sm hover:bg-accent transition-colors"
                  >
                    {t('common.back')}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Printer size={15} /> {t('admin.orders.print', { defaultValue: 'Print / save PDF' })}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-6">
                {/* Customer + fulfilment */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      {t('admin.reservations.col_customer')}
                    </h3>
                    <p className="font-medium">{selected.customerName}</p>
                    <p className="text-muted-foreground">{selected.customerPhone}</p>
                    {selected.customerEmail && <p className="text-muted-foreground break-all">{selected.customerEmail}</p>}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      {t('admin.reservations.col_type')}
                    </h3>
                    <p className="flex items-center gap-1.5 font-medium">
                      {FULFILLMENT_ICONS[selected.fulfillmentType]}
                      {FULFILLMENT_LABEL_KEYS[selected.fulfillmentType]
                        ? t(FULFILLMENT_LABEL_KEYS[selected.fulfillmentType])
                        : selected.fulfillmentType}
                    </p>
                    {selected.fulfillmentType === 'DELIVERY' && selected.deliveryAddress ? (
                      <p className="text-muted-foreground">
                        {[selected.deliveryAddress.streetAddress, selected.deliveryAddress.village,
                          selected.deliveryAddress.cell, selected.deliveryAddress.sector,
                          selected.deliveryAddress.district, selected.deliveryAddress.province]
                          .filter(Boolean).join(', ')}
                      </p>
                    ) : selected.visitDate ? (
                      <p className="text-muted-foreground">
                        {formatDate(selected.visitDate)}{selected.visitTime ? ` ${t('admin.reservations.at')} ${selected.visitTime}` : ''}
                      </p>
                    ) : null}
                    {selected.scheduledDeliveryDate && (
                      <p className="text-muted-foreground">{formatDate(selected.scheduledDeliveryDate)}</p>
                    )}
                  </div>
                </section>

                {/* Ordered specification */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {t('admin.orders.specs', { defaultValue: 'Ordered specification' })}
                  </h3>
                  <div className="border border-border rounded-xl px-4">
                    {selected.items.length === 0 ? (
                      <p className="py-4 text-sm text-muted-foreground">—</p>
                    ) : (
                      selected.items.map((item) => <ItemSpecs key={item.id} item={item} />)
                    )}
                  </div>
                  {selected.notes && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium text-foreground">{t('reservation.notes')}:</span> {selected.notes}
                    </p>
                  )}
                </section>

                {/* Money */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {t('admin.orders.breakdown', { defaultValue: 'Price breakdown' })}
                  </h3>
                  <dl className="border border-border rounded-xl p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t('cart.subtotal', { defaultValue: 'Subtotal' })}</dt>
                      <dd>{money(selected.subtotal ?? selected.items.reduce((s, i) => s + (i.totalPrice ?? 0), 0))}</dd>
                    </div>
                    {!!selected.discount && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">{t('cart.discount', { defaultValue: 'Discount' })}</dt>
                        <dd>−{money(selected.discount)}</dd>
                      </div>
                    )}
                    {!!selected.deliveryFee && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">{t('delivery.fee')}</dt>
                        <dd>{money(selected.deliveryFee)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 font-semibold">
                      <dt>{t('admin.reservations.total_amount')}</dt>
                      <dd className="text-primary">{money(selected.totalAmount)}</dd>
                    </div>
                  </dl>

                  {(selected.fulfillmentType === 'PICKUP' || selected.fulfillmentType === 'DELIVERY') && (
                    <div className="mt-3">
                      <label htmlFor="admin-amount" className="text-sm font-medium block mb-1.5">
                        {t('admin.reservations.amount_to_charge')}
                      </label>
                      <input
                        id="admin-amount" type="number" min="0" step="1" inputMode="numeric" value={amount}
                        onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 45000"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.reservations.amount_hint')}</p>
                    </div>
                  )}
                </section>

                {/* Payment */}
                {(selected.fulfillmentType === 'PICKUP' || selected.fulfillmentType === 'DELIVERY') && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {t('admin.reservations.payment')}
                    </h3>
                    <div className="border border-border rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm">
                          <p className="flex items-center gap-1.5 font-medium">
                            <CreditCard size={14} className="text-primary" />
                            {selected.payments?.[0]
                              ? t(`payment.${selected.payments[0].method}`, { defaultValue: selected.payments[0].method.replace(/_/g, ' ') })
                              : t('payment.PAY_AT_SHOP')}
                          </p>
                          {selected.payments?.[0]?.reference && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5 select-all">
                              {selected.payments[0].reference}
                            </p>
                          )}
                        </div>
                        <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', PS_COLORS[selected.paymentStatus] || 'bg-muted')}>
                          {PS_LABELS[selected.paymentStatus] || selected.paymentStatus}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {selected.paymentStatus === 'COMPLETED' ? (
                          <button
                            type="button"
                            onClick={() => paymentMutation.mutate({ id: selected.id, paymentStatus: 'PENDING' })}
                            disabled={paymentMutation.isPending}
                            className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-60"
                          >
                            {t('admin.reservations.mark_unpaid')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => paymentMutation.mutate({ id: selected.id, paymentStatus: 'COMPLETED' })}
                            disabled={paymentMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                          >
                            {paymentMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            {t('admin.reservations.mark_paid')}
                          </button>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Status + message */}
                <section className="space-y-3">
                  <div>
                    <label htmlFor="admin-status" className="text-sm font-medium block mb-1.5">
                      {t('admin.reservations.update_status')}
                    </label>
                    <select
                      id="admin-status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {ALL_STATUSES.filter(Boolean).map((s) => (
                        <option key={s} value={s}>{getStatusLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admin-note" className="text-sm font-medium block mb-1.5">
                      {t('admin.reservations.message_to_customer')}
                    </label>
                    <textarea
                      id="admin-note" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={3}
                      placeholder={t('admin.reservations.message_placeholder')}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </section>

                {/* History */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {t('admin.orders.history', { defaultValue: 'Status history' })}
                  </h3>
                  {selected.statusHistory && selected.statusHistory.length > 0 ? (
                    <ol className="space-y-2.5">
                      {selected.statusHistory.map((event) => (
                        <li key={event.id} className="flex gap-3 text-sm">
                          <Clock size={13} className="text-muted-foreground mt-1 shrink-0" />
                          <div>
                            <p className="font-medium">
                              {event.status ? getStatusLabel(event.status) : PS_LABELS[event.paymentStatus ?? ''] ?? event.paymentStatus}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.createdAt).toLocaleString('en-RW')} · {event.actor.split(':')[0]}
                            </p>
                            {event.note && <p className="text-xs text-muted-foreground italic mt-0.5">“{event.note}”</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('admin.orders.no_history', { defaultValue: 'No status changes recorded yet.' })}
                    </p>
                  )}
                </section>

                <div className="flex gap-3 sticky bottom-0 bg-card pt-3 pb-1 border-t border-border">
                  <button
                    type="button" onClick={() => setSelected(null)}
                    className="flex-1 py-2.5 border border-border rounded-xl text-sm hover:bg-accent transition-colors"
                  >
                    {t('admin.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatusMutation.mutate({ id: selected.id, status: newStatus, adminNotes, totalAmount: amount })}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70"
                  >
                    {updateStatusMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                    {updateStatusMutation.isPending ? t('admin.reservations.updating') : t('admin.reservations.update_status')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReservations;
