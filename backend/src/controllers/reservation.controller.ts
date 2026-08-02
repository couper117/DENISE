import { Request, Response } from 'express';
import QRCode from 'qrcode';
import prisma from '../config/database';
import { generateReservationNumber, getPaginationParams, buildPaginationResponse } from '../utils/helpers';
import { notifyReservationCreated, notifyStatusUpdate } from '../services/notification.service';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

export const createReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      customerName, customerPhone, customerEmail, preferredLanguage,
      fulfillmentType, visitDate, visitTime,
      notes, measurementOption, items,
      paymentMethod, mobileMoneyPhone,
      deliveryType, deliveryAddress,
      scheduledDeliveryDate,
    } = req.body;

    const mode = fulfillmentType || 'RESERVATION';
    const reservationNumber = generateReservationNumber();
    const qrCode = await QRCode.toDataURL(`DENISE-${reservationNumber}`);

    // Build delivery address if provided
    let deliveryAddressId: string | undefined;
    if (mode === 'DELIVERY' && deliveryAddress?.province && deliveryAddress?.district) {
      const created = await prisma.deliveryAddress.create({
        data: {
          province: deliveryAddress.province,
          district: deliveryAddress.district,
          sector: deliveryAddress.sector || null,
          cell: deliveryAddress.cell || null,
          village: deliveryAddress.village || null,
          streetAddress: deliveryAddress.streetAddress || null,
        },
      });
      deliveryAddressId = created.id;
    }

    // Determine delivery fee from zone data
    let deliveryFeeAmount: number | null = null;
    if (mode === 'DELIVERY' && deliveryAddress?.province) {
      const zone = await prisma.deliveryZone.findFirst({
        where: { province: deliveryAddress.province, isActive: true },
      });
      deliveryFeeAmount = zone ? zone.baseFee : 5000;
      if (deliveryType === 'SAME_DAY') deliveryFeeAmount = (deliveryFeeAmount || 0) + 1000;
    }

    const reservation = await prisma.reservation.create({
      data: {
        reservationNumber,
        qrCode,
        userId: req.user?.id || null,
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        preferredLanguage: preferredLanguage || 'en',
        fulfillmentType: mode,
        visitDate: mode === 'RESERVATION' && visitDate ? new Date(visitDate) : null,
        visitTime: mode === 'RESERVATION' ? visitTime || null : null,
        notes: notes || null,
        measurementOption: measurementOption || 'HELP_AT_SHOP',
        deliveryAddressId: deliveryAddressId || null,
        deliveryType: mode === 'DELIVERY' ? (deliveryType || 'NEXT_DAY') : null,
        deliveryFee: deliveryFeeAmount,
        paymentStatus: mode === 'RESERVATION' ? 'AWAITING' : 'PENDING',
        items: items && items.length > 0 ? {
          create: items.map((item: {
            productId: string;
            quantity?: number;
            metersRequired?: number;
            windowWidth?: number;
            windowHeight?: number;
            unitPrice?: number;
            totalPrice?: number;
            notes?: string;
          }) => ({
            productId: item.productId,
            quantity: item.quantity || null,
            metersRequired: item.metersRequired || null,
            windowWidth: item.windowWidth || null,
            windowHeight: item.windowHeight || null,
            unitPrice: item.unitPrice || null,
            totalPrice: item.totalPrice || null,
            notes: item.notes || null,
          })),
        } : undefined,
      },
      include: {
        items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
        deliveryAddress: true,
      },
    });

    // Create payment record for online-payment orders
    if ((mode === 'PICKUP' || mode === 'DELIVERY') && paymentMethod && paymentMethod !== 'PAY_AT_SHOP') {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          method: paymentMethod,
          amount: deliveryFeeAmount || 0,
          currency: 'RWF',
          status: 'PENDING',
          phoneNumber: mobileMoneyPhone || null,
        },
      }).catch((e) => logger.error('Payment record creation failed:', e));
    }

    if (items && items.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: items.map((i: { productId: string }) => i.productId) } },
        data: { reservationCount: { increment: 1 } },
      });
    }

    const formattedDate = visitDate
      ? new Date(visitDate).toLocaleDateString('en-RW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : mode === 'DELIVERY' ? 'Delivery order' : 'Pickup order';

    await notifyReservationCreated({
      reservationId: reservation.id,
      customerName,
      customerPhone,
      customerEmail,
      reservationNumber,
      fulfillmentType: mode,
      visitDate: formattedDate,
      visitTime: visitTime || '',
      qrCode,
    }).catch((e) => logger.error('Notification failed:', e));

    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    logger.error('CreateReservation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create reservation' });
  }
};

export const getReservationByNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const { number } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { reservationNumber: number },
      include: {
        items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
        deliveryAddress: true,
        payments: true,
      },
    });
    if (!reservation) { res.status(404).json({ success: false, message: 'Reservation not found' }); return; }
    res.json({ success: true, data: reservation });
  } catch (error) {
    logger.error('GetReservation error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reservation' });
  }
};

export const getMyReservations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
        deliveryAddress: true,
      },
    });
    res.json({ success: true, data: reservations });
  } catch (error) {
    logger.error('GetMyReservations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reservations' });
  }
};

export const getAllReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, status, search, date, fulfillmentType } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = String(status);
    if (fulfillmentType) where.fulfillmentType = String(fulfillmentType);
    if (date) {
      const d = new Date(String(date));
      where.visitDate = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lte: new Date(d.setHours(23, 59, 59, 999)),
      };
    }
    if (search) {
      where.OR = [
        { customerName: { contains: String(search), mode: 'insensitive' } },
        { customerPhone: { contains: String(search), mode: 'insensitive' } },
        { reservationNumber: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const { skip, take } = getPaginationParams(Number(page), Number(limit));
    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: { select: { name: true } } } },
          deliveryAddress: true,
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({ success: true, data: reservations, pagination: buildPaginationResponse(total, Number(page), Number(limit)) });
  } catch (error) {
    logger.error('GetAllReservations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reservations' });
  }
};

export const updateReservationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, adminNotes, cancelReason } = req.body;

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes || null,
        cancelReason: status === 'CANCELLED' ? cancelReason : null,
      },
    });

    const formattedDate = reservation.visitDate
      ? reservation.visitDate.toLocaleDateString('en-RW')
      : reservation.fulfillmentType === 'DELIVERY' ? 'Delivery order' : 'Pickup order';

    await notifyStatusUpdate({
      reservationId: reservation.id,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      reservationNumber: reservation.reservationNumber,
      fulfillmentType: reservation.fulfillmentType,
      visitDate: formattedDate,
      visitTime: reservation.visitTime,
      status,
    }).catch((e) => logger.error('Status notification failed:', e));

    res.json({ success: true, data: reservation });
  } catch (error) {
    logger.error('UpdateReservationStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update reservation status' });
  }
};

export const cancelReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { cancelReason } = req.body;

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation) { res.status(404).json({ success: false, message: 'Reservation not found' }); return; }

    if (reservation.userId && reservation.userId !== req.user?.id && req.user?.role === 'CUSTOMER') {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    if (['COMPLETED', 'CANCELLED', 'DELIVERED'].includes(reservation.status)) {
      res.status(400).json({ success: false, message: 'Cannot cancel this reservation' });
      return;
    }

    await prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED', cancelReason } });
    res.json({ success: true, message: 'Reservation cancelled' });
  } catch (error) {
    logger.error('CancelReservation error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel reservation' });
  }
};

export const getReservationStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, daily, weekly, monthly, byStatus, byFulfillment] = await Promise.all([
      prisma.reservation.count(),
      prisma.reservation.count({ where: { createdAt: { gte: today } } }),
      prisma.reservation.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.reservation.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.reservation.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.reservation.groupBy({ by: ['fulfillmentType'], _count: { fulfillmentType: true } }),
    ]);

    res.json({ success: true, data: { total, daily, weekly, monthly, byStatus, byFulfillment } });
  } catch (error) {
    logger.error('GetReservationStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};
