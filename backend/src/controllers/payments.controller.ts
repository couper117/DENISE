import { Request, Response } from 'express';
import prisma from '../config/database';
import { DELIVERY_FEES } from '../utils/delivery';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

const PAYMENT_METHODS = [
  'MTN_MOMO', 'AIRTEL_MONEY', 'VISA', 'MASTERCARD', 'AMEX',
  'BANK_TRANSFER', 'FLUTTERWAVE', 'PAYPAL', 'STRIPE', 'PAY_AT_SHOP',
];

export const initiatePayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { reservationId, method, phoneNumber } = req.body;

    if (!reservationId || !method) {
      res.status(400).json({ success: false, message: 'reservationId and method are required' });
      return;
    }
    if (!PAYMENT_METHODS.includes(method)) {
      res.status(400).json({ success: false, message: 'Invalid payment method' });
      return;
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { items: true },
    });
    if (!reservation) { res.status(404).json({ success: false, message: 'Reservation not found' }); return; }

    // Ownership: a reservation tied to an account can only be paid by its owner (or an admin)
    if (reservation.userId && reservation.userId !== req.user?.id && req.user?.role === 'CUSTOMER') {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    // Amount is derived server-side — never trusted from the client
    const goodsTotal = reservation.items.reduce((sum, it) => sum + (it.totalPrice ?? 0), 0);
    const amountOwed = reservation.totalAmount ?? Math.round(goodsTotal) + (reservation.deliveryFee ?? 0);
    if (amountOwed <= 0) {
      res.status(400).json({ success: false, message: 'This reservation has no online-payable amount' });
      return;
    }

    const payment = await prisma.payment.create({
      data: {
        reservationId,
        method,
        amount: amountOwed,
        currency: 'RWF',
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
        amount: payment.amount,
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
      data: dbZones.length > 0
        ? dbZones
        : Object.entries(DELIVERY_FEES).map(([province, fee]) => ({ province, baseFee: fee, currency: 'RWF' })),
    });
  } catch (error) {
    logger.error('GetDeliveryFees error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch delivery fees' });
  }
};
