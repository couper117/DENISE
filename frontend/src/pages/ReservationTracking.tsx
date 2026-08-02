import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Search, Package, Calendar, Clock, User, Phone, Mail,
  MapPin, Truck, Store, CreditCard, CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { reservationsApi } from '../lib/api';
import { Reservation, FulfillmentType } from '../types';
import { formatDate, getStatusColor, getStatusLabel } from '../lib/utils';
import QRCode from 'qrcode.react';

// Status pipeline per fulfillment type
const STATUS_PIPELINES: Record<FulfillmentType, string[]> = {
  RESERVATION: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED'],
  PICKUP: ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_PICKUP', 'COMPLETED'],
  DELIVERY: ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'],
};

const STATUS_DESCRIPTIONS: Record<string, Record<FulfillmentType, string>> = {
  PENDING: {
    RESERVATION: 'Reservation received, awaiting confirmation',
    PICKUP: 'Order received, awaiting confirmation',
    DELIVERY: 'Order received, awaiting confirmation',
  },
  CONFIRMED: {
    RESERVATION: 'Reservation confirmed by our team',
    PICKUP: 'Order confirmed — preparing your items',
    DELIVERY: 'Order confirmed — preparing for delivery',
  },
  PREPARING: {
    RESERVATION: 'Products being set aside for your visit',
    PICKUP: 'Products being prepared for pickup',
    DELIVERY: 'Products being prepared for delivery',
  },
  PROCESSING: {
    RESERVATION: 'Order is being processed',
    PICKUP: 'Order is being processed',
    DELIVERY: 'Order is being processed',
  },
  PACKED: {
    RESERVATION: 'Products packed and ready',
    PICKUP: 'Order is packed — ready for pickup soon',
    DELIVERY: 'Order is packed — waiting for courier pickup',
  },
  READY_FOR_PICKUP: {
    RESERVATION: 'Products ready! Come visit us',
    PICKUP: 'Your order is ready for pickup at our store',
    DELIVERY: 'Order ready',
  },
  OUT_FOR_DELIVERY: {
    RESERVATION: 'Out for delivery',
    PICKUP: 'Out for delivery',
    DELIVERY: 'Your order is on the way to you!',
  },
  DELIVERED: {
    RESERVATION: 'Delivered',
    PICKUP: 'Delivered',
    DELIVERY: 'Order delivered successfully',
  },
  COMPLETED: {
    RESERVATION: 'Purchase completed. Thank you!',
    PICKUP: 'Order picked up successfully. Thank you!',
    DELIVERY: 'Order delivered and completed. Thank you!',
  },
};

const STATUS_ICONS: Record<string, string> = {
  PENDING: '📋',
  CONFIRMED: '✅',
  PREPARING: '📦',
  PROCESSING: '⚙️',
  PACKED: '📫',
  READY_FOR_PICKUP: '🏪',
  OUT_FOR_DELIVERY: '🚚',
  DELIVERED: '🎉',
  COMPLETED: '⭐',
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  AWAITING: { label: 'Awaiting Payment', color: 'bg-yellow-100 text-yellow-800' },
  PENDING: { label: 'Payment Pending', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Payment Failed', color: 'bg-red-100 text-red-800' },
  REFUNDED: { label: 'Refunded', color: 'bg-purple-100 text-purple-800' },
};

const ReservationTracking = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [refNumber, setRefNumber] = useState(searchParams.get('ref') || '');
  const [reservation, setReservation] = useState<Reservation | null>(null);

  const trackMutation = useMutation({
    mutationFn: (number: string) =>
      reservationsApi.track(number).then((r) => r.data.data as Reservation),
    onSuccess: (data) => setReservation(data),
  });

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) trackMutation.mutate(ref);
  }, []);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (refNumber.trim()) trackMutation.mutate(refNumber.trim());
  };

  const fulfillmentType: FulfillmentType = reservation?.fulfillmentType ?? 'RESERVATION';
  const pipeline = STATUS_PIPELINES[fulfillmentType];
  const currentStatusIndex = reservation ? pipeline.indexOf(reservation.status) : -1;

  const isDelivery = fulfillmentType === 'DELIVERY';
  const isPickup = fulfillmentType === 'PICKUP';
  const requiresPayment = isDelivery || isPickup;

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center mb-10">
        <h1 className="font-serif text-3xl font-bold mb-2">{t('reservation.track_title')}</h1>
        <p className="text-muted-foreground">
          Enter your reference number to track your {isDelivery ? 'delivery' : isPickup ? 'order' : 'reservation'}
        </p>
      </div>

      <form onSubmit={handleTrack} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={refNumber} onChange={(e) => setRefNumber(e.target.value)}
            placeholder={t('reservation.track_placeholder')}
            className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button type="submit" disabled={trackMutation.isPending || !refNumber.trim()}
          className="px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
          {trackMutation.isPending ? '...' : t('reservation.track_button')}
        </button>
      </form>

      {trackMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-600 mb-6">
          Reference not found. Please check your number and try again.
        </div>
      )}

      {reservation && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Header card */}
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-lg">
                {isDelivery ? '🚚' : isPickup ? '📦' : '🏪'}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {isDelivery ? 'Delivery Order' : isPickup ? 'Pickup Order' : 'Shop Reservation'}
              </span>
            </div>
            <p className="text-2xl font-mono font-bold text-primary mb-4">
              {reservation.reservationNumber}
            </p>
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(reservation.status)}`}>
              {STATUS_ICONS[reservation.status] ?? '•'} {getStatusLabel(reservation.status)}
            </span>

            {/* Payment status badge (for paid orders) */}
            {requiresPayment && reservation.paymentStatus && (
              <div className="mt-3 flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${PAYMENT_STATUS_LABELS[reservation.paymentStatus]?.color ?? 'bg-muted'}`}>
                  <CreditCard size={11} />
                  {PAYMENT_STATUS_LABELS[reservation.paymentStatus]?.label ?? reservation.paymentStatus}
                </span>
              </div>
            )}

            {reservation.qrCode && (
              <div className="mt-5 flex justify-center">
                <div className="p-3 bg-white rounded-xl border border-border inline-block">
                  <QRCode value={reservation.reservationNumber} size={100} />
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {isPickup ? 'Show to collect order' : 'Show at the shop'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Progress timeline */}
          {reservation.status !== 'CANCELLED' && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-5">Order Progress</h3>
              <div className="relative">
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />
                <div className="space-y-5">
                  {pipeline.map((status, i) => {
                    const done = i < currentStatusIndex;
                    const active = i === currentStatusIndex;
                    const future = i > currentStatusIndex;
                    return (
                      <div key={status} className={`relative flex items-start gap-4 ${future ? 'opacity-40' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors text-sm ${
                          done ? 'bg-primary text-white' :
                          active ? 'bg-primary text-white ring-4 ring-primary/20' :
                          'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {done ? <CheckCircle2 size={14} /> : STATUS_ICONS[status] ?? i + 1}
                        </div>
                        <div className="pt-1">
                          <p className={`font-medium text-sm ${active ? 'text-primary' : ''}`}>
                            {getStatusLabel(status)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {STATUS_DESCRIPTIONS[status]?.[fulfillmentType] ?? ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Cancelled */}
          {reservation.status === 'CANCELLED' && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="font-medium text-red-700 dark:text-red-300">
                {isDelivery ? 'Order' : isPickup ? 'Order' : 'Reservation'} Cancelled
              </p>
              {reservation.cancelReason && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{reservation.cancelReason}</p>
              )}
            </div>
          )}

          {/* Delivery address (for DELIVERY) */}
          {isDelivery && reservation.deliveryAddress && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin size={15} className="text-primary" /> Delivery Address
              </h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">
                  {reservation.deliveryAddress.district}, {reservation.deliveryAddress.province}
                </p>
                {reservation.deliveryAddress.sector && (
                  <p className="text-muted-foreground">{reservation.deliveryAddress.sector}</p>
                )}
                {reservation.deliveryAddress.streetAddress && (
                  <p className="text-muted-foreground">{reservation.deliveryAddress.streetAddress}</p>
                )}
              </div>
              {reservation.deliveryType && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Truck size={12} className="text-primary" />
                  {reservation.deliveryType === 'SAME_DAY' ? 'Same Day Delivery' :
                   reservation.deliveryType === 'NEXT_DAY' ? 'Next Day Delivery' : 'Scheduled Delivery'}
                </div>
              )}
            </div>
          )}

          {/* Reservation details */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <h3 className="font-semibold mb-4">
              {isDelivery ? 'Order' : isPickup ? 'Order' : 'Reservation'} Details
            </h3>
            <div className="flex items-center gap-3 text-sm">
              <User size={15} className="text-primary shrink-0" />
              <span>{reservation.customerName}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone size={15} className="text-primary shrink-0" />
              <span>{reservation.customerPhone}</span>
            </div>
            {reservation.customerEmail && (
              <div className="flex items-center gap-3 text-sm">
                <Mail size={15} className="text-primary shrink-0" />
                <span>{reservation.customerEmail}</span>
              </div>
            )}
            {reservation.visitDate && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={15} className="text-primary shrink-0" />
                <span>{formatDate(reservation.visitDate)}</span>
              </div>
            )}
            {reservation.visitTime && (
              <div className="flex items-center gap-3 text-sm">
                <Clock size={15} className="text-primary shrink-0" />
                <span>{reservation.visitTime}</span>
              </div>
            )}
            {(reservation.totalAmount !== undefined && reservation.totalAmount !== null) && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="font-semibold">Total Amount:</span>
                <span className="font-bold text-primary">
                  {reservation.totalAmount.toLocaleString()} RWF
                </span>
              </div>
            )}
            {reservation.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">Notes: {reservation.notes}</p>
              </div>
            )}
          </div>

          {/* Items */}
          {reservation.items && reservation.items.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Package size={16} className="text-primary" />
                {isDelivery ? 'Ordered' : 'Reserved'} Products ({reservation.items.length})
              </h3>
              <div className="space-y-3">
                {reservation.items.map((item) => {
                  const img = item.product.images?.find((i) => i.isPrimary) || item.product.images?.[0];
                  return (
                    <div key={item.id} className="flex gap-3 items-center">
                      <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden shrink-0">
                        {img && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity && `Qty: ${item.quantity}`}
                          {item.metersRequired && ` • ${item.metersRequired}m`}
                          {item.totalPrice && ` • ${item.totalPrice.toLocaleString()} RWF`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin message */}
          {reservation.adminNotes && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm font-medium text-primary mb-1 flex items-center gap-2">
                {isDelivery ? <Truck size={13} /> : <Store size={13} />}
                Message from DENISE Team
              </p>
              <p className="text-sm text-muted-foreground">{reservation.adminNotes}</p>
            </div>
          )}

          {/* Contact CTA */}
          <div className="bg-muted/50 rounded-xl p-4 text-center text-sm">
            <p className="text-muted-foreground mb-2">Need help with your order?</p>
            <a
              href="https://wa.me/250780000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              💬 WhatsApp Us
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ReservationTracking;
