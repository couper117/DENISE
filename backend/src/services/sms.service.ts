import twilio from 'twilio';
import logger from '../utils/logger';

const getClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
};

export const sendSMS = async (to: string, message: string): Promise<boolean> => {
  const client = getClient();
  if (!client) { logger.warn('Twilio not configured — SMS skipped'); return false; }
  try {
    await client.messages.create({ body: message, from: process.env.TWILIO_PHONE_NUMBER, to });
    return true;
  } catch (error) {
    logger.error('SMS send failed:', error);
    return false;
  }
};

export const sendWhatsApp = async (to: string, message: string): Promise<boolean> => {
  const client = getClient();
  if (!client) { logger.warn('Twilio not configured — WhatsApp skipped'); return false; }
  try {
    await client.messages.create({ body: message, from: process.env.TWILIO_WHATSAPP_NUMBER, to: `whatsapp:${to}` });
    return true;
  } catch (error) {
    logger.error('WhatsApp message failed:', error);
    return false;
  }
};

export const sendReservationSMS = async (
  phone: string,
  customerName: string,
  reservationNumber: string,
  visitDate: string,
  visitTime: string
): Promise<boolean> => {
  const message = `Hello ${customerName}! Your reservation at DENISE Textile is confirmed.\nRef: ${reservationNumber}\nDate: ${visitDate} at ${visitTime}\nLocation: Kigali, Rwanda\nThank you for choosing us!`;
  return sendSMS(phone, message);
};

export const sendReservationWhatsApp = async (
  phone: string,
  customerName: string,
  reservationNumber: string,
  visitDate: string,
  visitTime: string
): Promise<boolean> => {
  const message = `Hello *${customerName}*! 🎉\n\nYour reservation at *DENISE Textile* is confirmed!\n\n📋 *Ref:* ${reservationNumber}\n📅 *Date:* ${visitDate}\n⏰ *Time:* ${visitTime}\n📍 *Location:* Kigali, Rwanda\n\nWe look forward to seeing you! 😊`;
  return sendWhatsApp(phone, message);
};
