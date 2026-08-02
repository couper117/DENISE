import prisma from '../config/database';
import { sendEmail, sendReservationConfirmation, sendReservationStatusUpdate } from './email.service';
import { sendSMS, sendReservationSMS, sendReservationWhatsApp } from './sms.service';
import logger from '../utils/logger';

type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP';
interface OutboundNotification {
  channel: Channel;
  recipient: string;
  body: string;
  send: () => Promise<boolean>;
}

// Persist one Notification row per channel, reflecting the ACTUAL delivery result
const recordNotifications = async (
  reservationId: string,
  channels: OutboundNotification[],
  results: PromiseSettledResult<boolean>[]
): Promise<void> => {
  const rows = channels.map((c, i) => {
    const r = results[i];
    const delivered = r.status === 'fulfilled' && r.value === true;
    return {
      reservationId,
      channel: c.channel,
      status: delivered ? ('SENT' as const) : ('FAILED' as const),
      body: c.body,
      recipient: c.recipient,
      sentAt: delivered ? new Date() : null,
      error: r.status === 'rejected'
        ? String(r.reason).slice(0, 500)
        : delivered ? null : 'Channel not configured or delivery failed',
    };
  });
  await prisma.notification.createMany({ data: rows }).catch((e) => logger.error('Failed to log notifications:', e));
};

interface ReservationNotificationData {
  reservationId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  reservationNumber: string;
  fulfillmentType?: string;
  visitDate?: string | null;
  visitTime?: string | null;
  qrCode?: string;
  status?: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  CONFIRMED: 'Your reservation has been confirmed. We are preparing your products.',
  PREPARING: 'Great news! We are currently preparing your reserved products.',
  PROCESSING: 'Your order is being processed.',
  PACKED: 'Your order has been packed and is ready.',
  READY_FOR_PICKUP: 'Your products are ready! Please visit our shop to complete your purchase.',
  OUT_FOR_DELIVERY: 'Your order is on the way! Our delivery team is heading to your address.',
  DELIVERED: 'Your order has been delivered. Thank you for shopping with DENISE Textile!',
  COMPLETED: 'Thank you for visiting DENISE Textile. We hope to see you again!',
  CANCELLED: 'Your reservation has been cancelled. Please contact us for more information.',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  RESERVATION: 'Shop Reservation',
  PICKUP: 'Online Pickup Order',
  DELIVERY: 'Home Delivery Order',
};

export const notifyReservationCreated = async (data: ReservationNotificationData): Promise<void> => {
  const {
    reservationId, customerName, customerPhone, customerEmail,
    reservationNumber, fulfillmentType, visitDate, visitTime, qrCode,
  } = data;

  const mode = fulfillmentType || 'RESERVATION';
  const modeLabel = FULFILLMENT_LABELS[mode] ?? mode;
  const dateInfo = visitDate || '';
  const timeInfo = visitTime || '';

  // Customer-facing channels, each tracked so we can record its real delivery result
  const channels: OutboundNotification[] = [];

  if (customerEmail && qrCode) {
    const email = customerEmail;
    channels.push({
      channel: 'EMAIL',
      recipient: email,
      body: `${modeLabel} confirmation`,
      send: () => sendReservationConfirmation(email, customerName, reservationNumber, dateInfo, timeInfo, qrCode),
    });
  }
  channels.push({
    channel: 'SMS',
    recipient: customerPhone,
    body: `${modeLabel} confirmation SMS`,
    send: () => sendReservationSMS(customerPhone, customerName, reservationNumber, dateInfo, timeInfo),
  });
  channels.push({
    channel: 'WHATSAPP',
    recipient: customerPhone,
    body: `${modeLabel} confirmation WhatsApp`,
    send: () => sendReservationWhatsApp(customerPhone, customerName, reservationNumber, dateInfo, timeInfo),
  });

  const results = await Promise.allSettled(channels.map((c) => c.send()));

  // Internal heads-up to staff (not logged as a customer notification)
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    sendEmail({
      to: adminEmail,
      subject: `New ${modeLabel}: ${reservationNumber}`,
      html: `<p>New <strong>${modeLabel}</strong> by <strong>${customerName}</strong> (${customerPhone})${visitDate ? ` for <strong>${visitDate}${visitTime ? ` at ${visitTime}` : ''}</strong>` : ''}. Ref: ${reservationNumber}</p>`,
    }).catch((e) => logger.error('Admin notification email failed:', e));
  }

  await recordNotifications(reservationId, channels, results);
};

export const notifyStatusUpdate = async (data: ReservationNotificationData): Promise<void> => {
  const { reservationId, customerEmail, customerPhone, customerName, reservationNumber, status } = data;

  const message = STATUS_MESSAGES[status || ''] || 'Your order status has been updated.';

  const channels: OutboundNotification[] = [];

  if (customerEmail) {
    const email = customerEmail;
    channels.push({
      channel: 'EMAIL',
      recipient: email,
      body: `Status update: ${status}`,
      send: () => sendReservationStatusUpdate(email, customerName, reservationNumber, status || '', message),
    });
  }

  // Send the SMS built from the ACTUAL status message (not the confirmation template)
  const smsBody = `Hello ${customerName}, ${message}\nRef: ${reservationNumber}\nDENISE Textile`;
  channels.push({
    channel: 'SMS',
    recipient: customerPhone,
    body: `Status update: ${status}`,
    send: () => sendSMS(customerPhone, smsBody),
  });

  const results = await Promise.allSettled(channels.map((c) => c.send()));
  await recordNotifications(reservationId, channels, results);
};
