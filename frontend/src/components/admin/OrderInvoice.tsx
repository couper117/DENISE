import { Reservation } from '../../types';
import { formatDate } from '../../lib/utils';
import {
  BUSINESS_ADDRESS, BUSINESS_EMAIL, BUSINESS_FULL_NAME, BUSINESS_NAME, BUSINESS_PHONE, WEBSITE_URL,
} from '../../lib/config';

const money = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value).toLocaleString()} RWF`;

/** The spec line the workshop and the customer both read. */
const specLine = (item: Reservation['items'][number]): string => {
  const o = item.options ?? {};
  const parts: string[] = [];
  if (o.color) parts.push(o.color);
  if (o.fabric) parts.push(o.fabric);
  if (item.windowWidth && item.windowHeight) parts.push(`${item.windowWidth} × ${item.windowHeight} cm`);
  if (item.metersRequired) parts.push(`${item.metersRequired} m`);
  if (o.fullness) parts.push(`${o.fullness}× fullness`);
  if (o.headerTypeLabel) parts.push(o.headerTypeLabel);
  if (o.liningLabel) parts.push(o.liningLabel);
  if (o.panelLayoutLabel) parts.push(o.panelLayoutLabel);
  return parts.join(' · ');
};

/**
 * Printable invoice for one order.
 *
 * Rendered inside the admin drawer and lifted onto its own page by the
 * `#print-area` rules in globals.css, so "print" and "save as PDF" are the
 * browser's own — no PDF dependency, and what staff see is what prints.
 * Deliberately plain black-on-white: this is a document, not a screen.
 */
const OrderInvoice = ({ order }: { order: Reservation }) => {
  const address = order.deliveryAddress;
  const payment = order.payments?.[0];
  const goods = order.subtotal ?? order.items.reduce((sum, i) => sum + (i.totalPrice ?? 0), 0);

  return (
    <div id="print-area" className="bg-white text-black p-8 text-[13px] leading-relaxed">
      <header className="flex justify-between items-start gap-8 border-b border-black/20 pb-5 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{BUSINESS_NAME}</h1>
          <p className="text-[11px] text-black/60">{BUSINESS_FULL_NAME}</p>
          <p className="text-[11px] text-black/60 mt-2">
            {BUSINESS_ADDRESS}<br />
            {BUSINESS_PHONE} · {BUSINESS_EMAIL}<br />
            {WEBSITE_URL.replace(/^https?:\/\//, '')}
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-semibold uppercase tracking-wider">Invoice</h2>
          <p className="font-mono font-bold">{order.reservationNumber}</p>
          <p className="text-[11px] text-black/60 mt-1">
            Issued {formatDate(order.createdAt)}<br />
            Status: {order.status}<br />
            Payment: {order.paymentStatus}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-black/50 mb-1">Bill to</h3>
          <p className="font-medium">{order.customerName}</p>
          <p>{order.customerPhone}</p>
          {order.customerEmail && <p>{order.customerEmail}</p>}
        </div>
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-black/50 mb-1">
            {order.fulfillmentType === 'DELIVERY' ? 'Deliver to' : order.fulfillmentType === 'PICKUP' ? 'Collection' : 'Shop visit'}
          </h3>
          {order.fulfillmentType === 'DELIVERY' && address ? (
            <p>
              {[address.streetAddress, address.village, address.cell, address.sector, address.district, address.province]
                .filter(Boolean).join(', ')}
              {order.deliveryType && <><br />{order.deliveryType.replace(/_/g, ' ').toLowerCase()}</>}
              {order.scheduledDeliveryDate && <><br />Scheduled {formatDate(order.scheduledDeliveryDate)}</>}
            </p>
          ) : order.visitDate ? (
            <p>{formatDate(order.visitDate)}{order.visitTime ? ` at ${order.visitTime}` : ''}</p>
          ) : (
            <p>Collection from {BUSINESS_ADDRESS}</p>
          )}
        </div>
      </section>

      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="border-y border-black/20 text-[11px] uppercase tracking-wider text-black/50">
            <th className="text-left py-2 font-semibold">Item &amp; specification</th>
            <th className="text-right py-2 font-semibold w-14">Qty</th>
            <th className="text-right py-2 font-semibold w-28">Unit</th>
            <th className="text-right py-2 font-semibold w-28">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-black/10 align-top">
              <td className="py-2.5 pr-4">
                <span className="font-medium">{item.product?.name ?? item.options?.productName ?? 'Item'}</span>
                {specLine(item) && <span className="block text-[11px] text-black/60">{specLine(item)}</span>}
                {item.notes && <span className="block text-[11px] text-black/60 italic">{item.notes}</span>}
              </td>
              <td className="py-2.5 text-right">{item.quantity ?? 1}</td>
              <td className="py-2.5 text-right">{money(item.unitPrice)}</td>
              <td className="py-2.5 text-right font-medium">{money(item.totalPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-6">
        <table className="text-right">
          <tbody>
            <tr>
              <td className="pr-6 py-1 text-black/60">Subtotal</td>
              <td className="py-1 font-medium">{money(goods)}</td>
            </tr>
            {!!order.discount && (
              <tr>
                <td className="pr-6 py-1 text-black/60">Discount</td>
                <td className="py-1 font-medium">−{money(order.discount)}</td>
              </tr>
            )}
            {!!order.deliveryFee && (
              <tr>
                <td className="pr-6 py-1 text-black/60">Delivery</td>
                <td className="py-1 font-medium">{money(order.deliveryFee)}</td>
              </tr>
            )}
            <tr className="border-t border-black/20">
              <td className="pr-6 py-2 font-semibold">Total</td>
              <td className="py-2 font-bold text-base">{money(order.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="border-t border-black/20 pt-4 text-[11px] text-black/70 space-y-1">
        <p>
          <strong>Payment method:</strong>{' '}
          {payment ? payment.method.replace(/_/g, ' ') : 'Pay in person'}
          {payment?.reference && <> · <strong>Ref:</strong> <span className="font-mono">{payment.reference}</span></>}
        </p>
        {order.notes && <p><strong>Customer notes:</strong> {order.notes}</p>}
        {order.adminNotes && <p><strong>Note to customer:</strong> {order.adminNotes}</p>}
        <p className="pt-2">
          Prices are in Rwandan Francs and include VAT where applicable. Thank you for shopping with {BUSINESS_NAME}.
        </p>
      </section>
    </div>
  );
};

export default OrderInvoice;
