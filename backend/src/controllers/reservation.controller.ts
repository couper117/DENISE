import { Request, Response } from 'express';
import QRCode from 'qrcode';
import prisma from '../config/database';
import { generateReservationNumber, getPaginationParams, buildPaginationResponse } from '../utils/helpers';
import { notifyReservationCreated, notifyStatusUpdate } from '../services/notification.service';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';

type ItemInput = {
  productId: string;
  quantity?: number;
  metersRequired?: number;
  windowWidth?: number;
  windowHeight?: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
};

const PAYMENT_METHODS = [
  'MTN_MOMO', 'AIRTEL_MONEY', 'VISA', 'MASTERCARD', 'AMEX',
  'BANK_TRANSFER', 'FLUTTERWAVE', 'PAYPAL', 'STRIPE', 'PAY_AT_SHOP',
];

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

    // ── Fetch products (with inventory) referenced by the cart ──────────────
    const itemList: ItemInput[] = Array.isArray(items) ? items : [];
    const productIds = [...new Set(itemList.map((i) => i.productId).filter(Boolean))];
    const products = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds } }, include: { inventory: true } })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Every cart item must reference a real product
    if (itemList.some((i) => !productMap.has(i.productId))) {
      res.status(400).json({ success: false, message: 'One or more products in the cart no longer exist' });
      return;
    }

    // ── Price every line server-side (never trust client-sent totals) ──────
    let goodsTotal = 0;
    const preparedItems = itemList.map((item) => {
      const product = productMap.get(item.productId)!;
      const qty = item.quantity ?? null;
      const meters = item.metersRequired ?? null;
      let unitPrice: number | null = null;
      let lineTotal = 0;
      if (meters != null && product.pricePerMeter != null) {
        unitPrice = product.pricePerMeter;
        lineTotal = product.pricePerMeter * meters;
      } else if (qty != null) {
        unitPrice = product.salePrice ?? product.price ?? null;
        lineTotal = (unitPrice ?? 0) * qty;
      } else if (item.totalPrice != null) {
        // Price-on-request items already quoted by staff
        lineTotal = item.totalPrice;
      }
      goodsTotal += lineTotal;
      return { item, product, qty, meters, unitPrice, lineTotal };
    });

    // ── Stock availability check (before writing anything) ─────────────────
    for (const p of preparedItems) {
      const inv = p.product.inventory;
      if (!inv?.isTracked) continue;
      if (p.qty != null && inv.stockCount < p.qty) {
        res.status(409).json({ success: false, message: `Insufficient stock for "${p.product.name}"` });
        return;
      }
      if (p.meters != null && inv.metersAvailable != null && inv.metersAvailable < p.meters) {
        res.status(409).json({ success: false, message: `Insufficient fabric length for "${p.product.name}"` });
        return;
      }
    }

    // Validate the payment method up-front so online orders don't fail mid-transaction
    const isOnlinePayment = (mode === 'PICKUP' || mode === 'DELIVERY') && paymentMethod && paymentMethod !== 'PAY_AT_SHOP';
    if (isOnlinePayment && !PAYMENT_METHODS.includes(paymentMethod)) {
      res.status(400).json({ success: false, message: 'Invalid payment method' });
      return;
    }

    const totalAmount = Math.round(goodsTotal) + (deliveryFeeAmount || 0);

    // ── Persist reservation, payment and stock changes atomically ──────────
    const reservation = await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
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
          totalAmount: totalAmount > 0 ? totalAmount : null,
          paymentStatus: mode === 'RESERVATION' ? 'AWAITING' : 'PENDING',
          items: preparedItems.length > 0 ? {
            create: preparedItems.map((p) => ({
              productId: p.item.productId,
              quantity: p.qty,
              metersRequired: p.meters,
              windowWidth: p.item.windowWidth || null,
              windowHeight: p.item.windowHeight || null,
              unitPrice: p.unitPrice,
              totalPrice: p.lineTotal || null,
              notes: p.item.notes || null,
            })),
          } : undefined,
        },
        include: {
          items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
          deliveryAddress: true,
        },
      });

      // Payment record bills the FULL amount owed (goods + delivery), not just delivery
      if (isOnlinePayment) {
        await tx.payment.create({
          data: {
            reservationId: created.id,
            method: paymentMethod,
            amount: totalAmount,
            currency: 'RWF',
            status: 'PENDING',
            phoneNumber: mobileMoneyPhone || null,
            reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          },
        });
      }

      // Decrement stock for tracked products
      for (const p of preparedItems) {
        const inv = p.product.inventory;
        if (!inv?.isTracked) continue;
        const invUpdate: { stockCount?: { decrement: number }; metersAvailable?: { decrement: number } } = {};
        if (p.qty != null) invUpdate.stockCount = { decrement: p.qty };
        if (p.meters != null && inv.metersAvailable != null) invUpdate.metersAvailable = { decrement: p.meters };
        if (Object.keys(invUpdate).length > 0) {
          await tx.inventory.update({ where: { productId: p.item.productId }, data: invUpdate });
        }
      }

      if (productIds.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: productIds } },
          data: { reservationCount: { increment: 1 } },
        });
      }

      return created;
    });

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

/** Compares phone numbers by digits alone, so formatting differences don't matter. */
const samePhone = (a: string, b: string): boolean => {
  const digits = (value: string) => value.replace(/\D/g, '');
  const left = digits(a);
  return left.length > 0 && left === digits(b);
};

export const cancelReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { cancelReason, customerPhone } = req.body;

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation) { res.status(404).json({ success: false, message: 'Reservation not found' }); return; }

    // Authorisation is allowlist-based: the caller must positively match one of
    // these three cases. The previous condition only rejected signed-in
    // CUSTOMERs cancelling someone else's booking, which left two holes — guest
    // reservations (userId null) were unprotected, and an anonymous caller
    // failed the `role === 'CUSTOMER'` test and so skipped the check entirely.
    const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
    const isOwner = !!reservation.userId && reservation.userId === req.user?.id;
    // Guests hold no session, so the phone on the booking acts as the shared
    // secret proving the caller is the person who made it.
    const provedByPhone =
      !reservation.userId && typeof customerPhone === 'string' && samePhone(customerPhone, reservation.customerPhone);

    if (!isAdmin && !isOwner && !provedByPhone) {
      res.status(403).json({
        success: false,
        message: reservation.userId
          ? 'Not authorized'
          : 'Confirm the phone number used for this reservation to cancel it',
      });
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
