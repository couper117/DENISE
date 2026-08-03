import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, CheckCircle2, ChevronDown, Clock, CreditCard, MapPin, Package,
  Receipt, Search, Store, Truck, Wallet, XCircle,
} from 'lucide-react';
import { reservationsApi } from '../../lib/api';
import { Reservation, ReservationStatus, FulfillmentType } from '../../types';
import { formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Seo from '../../components/Seo';
import { EditableText } from '../../cms';

/**
 * Everything the signed-in customer has ordered, with enough detail that they
 * do not have to contact the shop to answer "what did I order, what did it
 * cost, and where is it now".
 *
 * New copy here uses EditableText's `fallback` rather than new i18n keys: the
 * fallback renders for everyone, and an admin can override it per locale from
 * the page itself — so shipping a string no longer means editing five JSON
 * files.
 */

const money = (n: number | undefined | null) => `${Math.round(n ?? 0).toLocaleString()} RWF`;

/** Terminal states, used to split "in progress" from "done". */
const CLOSED: ReservationStatus[] = ['COMPLETED', 'DELIVERED', 'CANCELLED'];

/**
 * The steps an order actually passes through, which differ by fulfillment type
 * — a shop visit never goes "out for delivery".
 */
const TIMELINE: Record<FulfillmentType, ReservationStatus[]> = {
  RESERVATION: ['PENDING', 'CONFIRMED', 'COMPLETED'],
  PICKUP: ['PENDING', 'CONFIRMED', 'PREPARING', 'PACKED', 'READY_FOR_PICKUP', 'COMPLETED'],
  DELIVERY: ['PENDING', 'CONFIRMED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'],
};

/** Finished states, whichever track the order was on. */
const FINISHED: ReservationStatus[] = ['DELIVERED', 'COMPLETED'];

const FULFILMENT_ICON = { RESERVATION: Store, PICKUP: Package, DELIVERY: Truck } as const;

type Filter = 'all' | 'active' | 'completed' | 'cancelled';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const StatusTimeline = ({ reservation }: { reservation: Reservation }) => {
  if (reservation.status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <XCircle size={15} />
        <span>Cancelled{reservation.cancelReason ? ` — ${reservation.cancelReason}` : ''}</span>
      </div>
    );
  }

  const steps = TIMELINE[reservation.fulfillmentType] ?? TIMELINE.RESERVATION;

  // An order can sit at a status that is not on its own track — a pickup marked
  // DELIVERED, or anything an admin corrected by hand. A finished order must
  // still show a finished timeline, so treat those as "all steps done" rather
  // than letting indexOf return -1 and render every step as pending.
  const found = steps.indexOf(reservation.status);
  const reached = found === -1 && FINISHED.includes(reservation.status) ? steps.length - 1 : found;

  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {steps.map((step, i) => {
        const done = reached >= i;
        const current = reached === i;
        return (
          <li key={step} className="flex items-center">
            <span className={`flex items-center gap-1.5 text-xs ${done ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                  done ? 'bg-primary border-primary text-white' : 'border-border'
                } ${current ? 'ring-2 ring-primary/25' : ''}`}
              >
                {done && <CheckCircle2 size={10} strokeWidth={3} />}
              </span>
              {getStatusLabel(step)}
            </span>
            {i < steps.length - 1 && (
              <span className={`w-6 h-px mx-1.5 ${reached > i ? 'bg-primary' : 'bg-border'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
};

const OrderCard = ({ reservation }: { reservation: Reservation }) => {
  const [open, setOpen] = useState(false);
  const Icon = FULFILMENT_ICON[reservation.fulfillmentType] ?? Store;
  const paid = reservation.paymentStatus === 'COMPLETED';
  const settled = (reservation.payments ?? []).filter((p) => p.status === 'COMPLETED');

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-primary">{reservation.reservationNumber}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(reservation.createdAt)}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(reservation.status)}`}>
              {getStatusLabel(reservation.status)}
            </span>
            <span className={`text-[11px] font-medium ${paid ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
              {paid ? 'Paid' : reservation.paymentStatus === 'AWAITING' ? 'Not paid yet' : getStatusLabel(reservation.paymentStatus)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1.5"><Icon size={13} />{getStatusLabel(reservation.fulfillmentType)}</span>
          {reservation.fulfillmentType === 'DELIVERY' && reservation.deliveryAddress && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} />
              {reservation.deliveryAddress.district}, {reservation.deliveryAddress.province}
            </span>
          )}
          {reservation.visitDate && (
            <span className="flex items-center gap-1.5"><Calendar size={13} />{formatDate(reservation.visitDate)}</span>
          )}
          {reservation.visitTime && (
            <span className="flex items-center gap-1.5"><Clock size={13} />{reservation.visitTime}</span>
          )}
          <span className="flex items-center gap-1.5">
            <Package size={13} />
            {reservation.items?.length ?? 0} item{(reservation.items?.length ?? 0) === 1 ? '' : 's'}
          </span>
          {reservation.totalAmount ? (
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Receipt size={13} />{money(reservation.totalAmount)}
            </span>
          ) : null}
        </div>

        <StatusTimeline reservation={reservation} />

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-border">
          <Link
            to={`/track?ref=${reservation.reservationNumber}`}
            className="text-sm font-semibold text-primary hover:underline underline-offset-4"
          >
            Track this order →
          </Link>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? 'Hide details' : 'View details'}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-muted/30 p-5 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Items</p>
            <ul className="space-y-3">
              {(reservation.items ?? []).map((item) => {
                const image = item.product?.images?.[0]?.url;
                const row = (
                  <>
                    <span className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0 block">
                      {image && <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{item.product?.name ?? 'Product'}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.quantity ? `Qty ${item.quantity}` : null}
                        {item.quantity && item.metersRequired ? ' · ' : null}
                        {item.metersRequired ? `${item.metersRequired} m` : null}
                      </span>
                    </span>
                    {item.totalPrice ? (
                      <span className="text-sm font-medium shrink-0">{money(item.totalPrice)}</span>
                    ) : null}
                  </>
                );

                return (
                  <li key={item.id}>
                    {item.product?.slug ? (
                      <Link to={`/products/${item.product.slug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {(reservation.deliveryFee || reservation.totalAmount) && (
            <div className="text-sm space-y-1">
              {reservation.deliveryFee ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery</span><span>{money(reservation.deliveryFee)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold pt-1 border-t border-border">
                <span>Total</span><span>{money(reservation.totalAmount)}</span>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payment</p>
            {settled.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Wallet size={13} /> Nothing paid yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {settled.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <CreditCard size={13} className="text-muted-foreground shrink-0" />
                    <span className="font-medium">{money(p.amount)}</span>
                    <span className="text-muted-foreground">via {getStatusLabel(p.method)}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{formatDate(p.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {reservation.notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Your note</p>
              <p className="text-sm text-muted-foreground">{reservation.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ReservationHistory = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-reservations'],
    queryFn: () => reservationsApi.getMyReservations().then((r) => r.data.data as Reservation[]),
  });

  const orders = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const active = orders.filter((o) => !CLOSED.includes(o.status)).length;
    // Only settled orders count as spent — an awaiting MoMo prompt is not money.
    const spent = orders
      .filter((o) => o.paymentStatus === 'COMPLETED')
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
    return { total: orders.length, active, spent };
  }, [orders]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === 'active' && CLOSED.includes(o.status)) return false;
      if (filter === 'completed' && o.status !== 'COMPLETED' && o.status !== 'DELIVERED') return false;
      if (filter === 'cancelled' && o.status !== 'CANCELLED') return false;
      if (!q) return true;
      return (
        o.reservationNumber.toLowerCase().includes(q) ||
        (o.items ?? []).some((i) => (i.product?.name ?? '').toLowerCase().includes(q))
      );
    });
  }, [orders, filter, search]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Seo path="/account/reservations" title="Your orders — DENISE Textile" noindex />

      <EditableText id="account.history_title" as="h1" fallback="Your orders"
        className="font-serif text-3xl font-bold" />
      <EditableText id="account.history_subtitle" as="p" multiline
        fallback="Every reservation, pickup and delivery you have placed with us."
        className="text-muted-foreground mt-1" />

      {isError && (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">
          We could not load your orders just now. Please refresh, or look up a single order by its
          reference on the <Link to="/track" className="underline">tracking page</Link>.
        </p>
      )}

      {orders.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { label: 'Orders', value: String(stats.total) },
              { label: 'In progress', value: String(stats.active) },
              { label: 'Total paid', value: money(stats.spent) },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-lg font-bold tabular-nums truncate">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-6">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filter === f.key
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}

            <div className="flex items-center gap-2 sm:ml-auto border border-border rounded-lg px-3 py-1.5 min-w-[180px]">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Reference or product"
                aria-label="Search your orders"
                className="bg-transparent text-sm outline-none w-full"
              />
            </div>
          </div>
        </>
      )}

      <div className="space-y-4 mt-6">
        {visible.map((reservation) => (
          <OrderCard key={reservation.id} reservation={reservation} />
        ))}
      </div>

      {orders.length > 0 && visible.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No orders match that filter.</p>
      )}

      {orders.length === 0 && !isError && (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <EditableText id="account.history_empty_title" as="h3" fallback="No orders yet"
            className="font-semibold mb-2" />
          <EditableText id="account.history_empty_body" as="p" multiline
            fallback="Browse the collection and place your first reservation — you can pay in store."
            className="text-muted-foreground mb-4" />
          <Link to="/products"
            className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
            <EditableText id="hero.cta_browse" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default ReservationHistory;
