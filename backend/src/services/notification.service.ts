import prisma from '../config/database';
import { sendEmail, sendReservationConfirmation, sendReservationStatusUpdate } from './email.service';
import { sendSMS, sendWhatsApp, sendReservationSMS, sendReservationWhatsApp } from './sms.service';
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
    reservationNumber, fulfillmentType, visitDate, visitTime,
  } = data;

  const mode = fulfillmentType || 'RESERVATION';
  const modeLabel = FULFILLMENT_LABELS[mode] ?? mode;
  const dateInfo = visitDate || '';
  const timeInfo = visitTime || '';

  // Customer-facing channels, each tracked so we can record its real delivery result
  const channels: OutboundNotification[] = [];

  if (customerEmail) {
    const email = customerEmail;
    channels.push({
      channel: 'EMAIL',
      recipient: email,
      body: `${modeLabel} confirmation`,
      send: () => sendReservationConfirmation(email, customerName, reservationNumber, dateInfo, timeInfo),
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

interface PaymentDueData {
  reservationId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  reservationNumber: string;
  amount: number;
}

// Sent when an online-payment order is confirmed and payment is due: the customer
// gets the amount and a tap-to-pay link (the Track page has the MoMo dial button).
export const notifyPaymentDue = async (data: PaymentDueData): Promise<void> => {
  const { reservationId, customerName, customerPhone, customerEmail, reservationNumber, amount } = data;
  const site = (process.env.FRONTEND_URL || 'https://deniseshop.com').replace(/\/+$/, '');
  const payLink = `${site}/track?ref=${reservationNumber}`;
  const amt = amount.toLocaleString();

  const channels: OutboundNotification[] = [
    {
      channel: 'SMS', recipient: customerPhone, body: `Payment due: ${amt} RWF`,
      send: () => sendSMS(customerPhone, `Hello ${customerName}! Your DENISE Textile order ${reservationNumber} is confirmed. Please pay ${amt} RWF via MTN MoMo here: ${payLink} then enter your PIN. Murakoze!`),
    },
    {
      channel: 'WHATSAPP', recipient: customerPhone, body: `Payment due: ${amt} RWF`,
      send: () => sendWhatsApp(customerPhone, `*DENISE Textile* 💳\n\nHello *${customerName}*! Your order *${reservationNumber}* is confirmed.\n\nPlease pay *${amt} RWF* via MTN MoMo:\n${payLink}\n\nTap the link, confirm, then enter your PIN. Murakoze! 😊`),
    },
  ];
  if (customerEmail) {
    const email = customerEmail;
    channels.push({
      channel: 'EMAIL', recipient: email, body: `Payment due for ${reservationNumber}`,
      send: () => sendEmail({
        to: email,
        subject: `Payment due — order ${reservationNumber}`,
        html: `<p>Hello ${customerName},</p><p>Your DENISE Textile order <strong>${reservationNumber}</strong> is confirmed. Please pay <strong>${amt} RWF</strong> via MTN Mobile Money.</p><p><a href="${payLink}">Pay now →</a></p><p>Murakoze!</p>`,
      }),
    });
  }

  const results = await Promise.allSettled(channels.map((c) => c.send()));
  await recordNotifications(reservationId, channels, results);
};
