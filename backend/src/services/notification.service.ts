import prisma from '../config/database';
import { sendEmail, sendReservationConfirmation, sendReservationStatusUpdate } from './email.service';
import { sendReservationSMS, sendReservationWhatsApp } from './sms.service';
import logger from '../utils/logger';

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

  const promises: Promise<boolean>[] = [];

  if (customerEmail && qrCode) {
    promises.push(
      sendReservationConfirmation(customerEmail, customerName, reservationNumber, dateInfo, timeInfo, qrCode)
    );
  }

  promises.push(sendReservationSMS(customerPhone, customerName, reservationNumber, dateInfo, timeInfo));
  promises.push(sendReservationWhatsApp(customerPhone, customerName, reservationNumber, dateInfo, timeInfo));

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    promises.push(
      sendEmail({
        to: adminEmail,
        subject: `New ${modeLabel}: ${reservationNumber}`,
        html: `<p>New <strong>${modeLabel}</strong> by <strong>${customerName}</strong> (${customerPhone})${visitDate ? ` for <strong>${visitDate}${visitTime ? ` at ${visitTime}` : ''}</strong>` : ''}. Ref: ${reservationNumber}</p>`,
      })
    );
  }

  await Promise.allSettled(promises);

  await prisma.notification.createMany({
    data: [
      { reservationId, channel: 'EMAIL', status: 'SENT', body: `${modeLabel} confirmation`, recipient: customerEmail || customerPhone },
      { reservationId, channel: 'SMS', status: 'SENT', body: `${modeLabel} confirmation SMS`, recipient: customerPhone },
      { reservationId, channel: 'WHATSAPP', status: 'SENT', body: `${modeLabel} confirmation WhatsApp`, recipient: customerPhone },
    ],
  }).catch((e) => logger.error('Failed to log notifications:', e));
};

export const notifyStatusUpdate = async (data: ReservationNotificationData): Promise<void> => {
  const { customerEmail, customerPhone, customerName, reservationNumber, status, fulfillmentType } = data;

  const message = STATUS_MESSAGES[status || ''] || 'Your order status has been updated.';

  if (customerEmail) {
    await sendReservationStatusUpdate(customerEmail, customerName, reservationNumber, status || '', message).catch(
      (e) => logger.error('Status email failed:', e)
    );
  }

  await sendReservationSMS(customerPhone, customerName, reservationNumber, '', '').catch(
    (e) => logger.error('Status SMS failed:', e)
  );
};
