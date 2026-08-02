import nodemailer from 'nodemailer';
import logger from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      ...options,
    });
    return true;
  } catch (error) {
    logger.error('Email send failed:', error);
    return false;
  }
};

export const sendReservationConfirmation = async (
  email: string,
  customerName: string,
  reservationNumber: string,
  visitDate: string,
  visitTime: string,
  qrCode: string
): Promise<boolean> => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Reservation Confirmation</title></head>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #8B1A1A; font-size: 28px; margin: 0;">DENISE Textile</h1>
          <p style="color: #666; margin: 5px 0;">New Textile Social Company Limited</p>
        </div>

        <h2 style="color: #333; text-align: center;">Reservation Confirmed!</h2>
        <p style="color: #555;">Dear ${customerName},</p>
        <p style="color: #555;">Your reservation has been successfully created. Here are your details:</p>

        <div style="background: #f8f8f8; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Reservation Number:</td><td style="padding: 8px 0; color: #8B1A1A; font-size: 18px; font-weight: bold;">${reservationNumber}</td></tr>
            <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Visit Date:</td><td style="padding: 8px 0; color: #333;">${visitDate}</td></tr>
            <tr><td style="padding: 8px 0; color: #666; font-weight: bold;">Visit Time:</td><td style="padding: 8px 0; color: #333;">${visitTime}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <img src="${qrCode}" alt="QR Code" style="width: 150px; height: 150px;" />
          <p style="color: #666; font-size: 12px;">Show this QR code at the shop</p>
        </div>

        <div style="background: #fff8f0; border-left: 4px solid #8B1A1A; padding: 15px; margin: 20px 0;">
          <p style="color: #555; margin: 0;"><strong>Shop Location:</strong><br />Kigali, Rwanda<br />Visit us at our store to complete your purchase.</p>
        </div>

        <p style="color: #555;">We look forward to seeing you!</p>
        <p style="color: #555;">Best regards,<br /><strong>DENISE Textile Team</strong></p>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">New Textile Social Company Limited | Kigali, Rwanda</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject: `Reservation Confirmed - ${reservationNumber} | DENISE Textile`, html });
};

export const sendReservationStatusUpdate = async (
  email: string,
  customerName: string,
  reservationNumber: string,
  status: string,
  message: string
): Promise<boolean> => {
  const statusColors: Record<string, string> = {
    CONFIRMED: '#22c55e',
    PREPARING: '#f59e0b',
    READY_FOR_PICKUP: '#3b82f6',
    COMPLETED: '#8B1A1A',
    CANCELLED: '#ef4444',
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px;">
        <h1 style="color: #8B1A1A; text-align: center;">DENISE Textile</h1>
        <h2 style="color: #333; text-align: center;">Reservation Update</h2>
        <p>Dear ${customerName},</p>
        <p>Your reservation <strong>${reservationNumber}</strong> has been updated:</p>
        <div style="text-align: center; padding: 20px;">
          <span style="background: ${statusColors[status] || '#666'}; color: white; padding: 10px 20px; border-radius: 20px; font-weight: bold; font-size: 16px;">${status.replace('_', ' ')}</span>
        </div>
        <p>${message}</p>
        <p>Best regards,<br/><strong>DENISE Textile Team</strong></p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject: `Reservation Update - ${reservationNumber} | DENISE Textile`, html });
};
