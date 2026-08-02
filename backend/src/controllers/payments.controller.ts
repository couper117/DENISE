import { Request, Response } from 'express';
import prisma from '../config/database';
import { DELIVERY_FEES } from '../utils/delivery';
import logger from '../utils/logger';

export const initiatePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reservationId, method, amount, currency = 'RWF', phoneNumber } = req.body;

    if (!reservationId || !method || !amount) {
      res.status(400).json({ success: false, message: 'reservationId, method and amount are required' });
      return;
    }

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) { res.status(404).json({ success: false, message: 'Reservation not found' }); return; }

    const payment = await prisma.payment.create({
      data: {
        reservationId,
        method,
        amount: Number(amount),
        currency,
        status: 'PENDING',
        phoneNumber: phoneNumber || null,
        reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      },
    });

    // TODO: integrate with actual payment gateway (Flutterwave / MTN MoMo API)
    // For now, return the payment record so frontend can poll /verify/:reference
    res.status(201).json({
      success: true,
      data: {
        paymentId: payment.id,
        reference: payment.reference,
        status: payment.status,
        redirectUrl: null,
      },
    });
  } catch (error) {
    logger.error('InitiatePayment error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate payment' });
  }
};

export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reference } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { reservation: { select: { reservationNumber: true, status: true } } },
    });
    if (!payment) { res.status(404).json({ success: false, message: 'Payment not found' }); return; }
    res.json({ success: true, data: payment });
  } catch (error) {
    logger.error('VerifyPayment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

export const getDeliveryFees = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Return both DB zones and static fallback
    const dbZones = await prisma.deliveryZone.findMany({ where: { isActive: true } });
    res.json({
      success: true,
      data: dbZones.length > 0 ? dbZones : DELIVERY_FEES,
    });
  } catch (error) {
    logger.error('GetDeliveryFees error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch delivery fees' });
  }
};
