import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { generateReservationNumber, getPaginationParams, buildPaginationResponse } from '../utils/helpers';
import { notifyReservationCreated, notifyStatusUpdate } from '../services/notification.service';
import { AuthenticatedRequest } from '../types';
import { priceLine, RawItemInput, NormalizedOptions } from '../utils/productOptions';
import logger from '../utils/logger';

const PAYMENT_METHODS = [
  'MTN_MOMO', 'AIRTEL_MONEY', 'VISA', 'MASTERCARD', 'AMEX',
  'BANK_TRANSFER', 'FLUTTERWAVE', 'PAYPAL', 'STRIPE', 'PAY_AT_SHOP',
];

/** Everything the customer-facing order views need in one shape. */
const customerOrderInclude = {
  items: { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
  deliveryAddress: true,
  payments: { orderBy: { createdAt: 'desc' } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ReservationInclude;

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
    const itemList: RawItemInput[] = Array.isArray(items) ? items : [];
    const productIds = [...new Set(itemList.map((i) => i.productId).filter(Boolean))];
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          include: { inventory: true, colors: true, category: { select: { name: true, slug: true } } },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Every cart item must reference a real product
    if (itemList.some((i) => !productMap.has(i.productId))) {
      res.status(400).json({ success: false, message: 'One or more products in the cart no longer exist' });
      return;
    }

    // A configured item can no longer be ordered if the product went off sale
    // between adding it to the cart and checking out.
    const unavailable = itemList.find((i) => !productMap.get(i.productId)!.isAvailable);
    if (unavailable) {
      res.status(409).json({
        success: false,
        message: `"${productMap.get(unavailable.productId)!.name}" is no longer available`,
      });
      return;
    }

    // ── Price every line server-side (never trust client-sent totals) ──────
    // The client sends only the *configuration*; `priceLine` re-derives metres
    // and money from the product row, so a tampered cart cannot change what is
    // owed. It also normalises the options against the catalogue before they
    // are stored.
    let goodsTotal = 0;
    let listTotal = 0;
    const preparedItems = itemList.map((item) => {
      const product = productMap.get(item.productId)!;
      const priced = priceLine(product, item);
      goodsTotal += priced.lineTotal;
      listTotal += priced.listTotal;
      return { item, product, priced };
    });

    // ── Stock availability check (before writing anything) ─────────────────
    // Quantities for the same product across several configured lines are
    // summed, otherwise two lines of 3 could each pass a stock-of-4 check.
    const qtyByProduct = new Map<string, number>();
    const metersByProduct = new Map<string, number>();
    for (const p of preparedItems) {
      qtyByProduct.set(p.product.id, (qtyByProduct.get(p.product.id) ?? 0) + p.priced.quantity);
      if (p.priced.meters != null) {
        metersByProduct.set(p.product.id, (metersByProduct.get(p.product.id) ?? 0) + p.priced.meters * p.priced.quantity);
      }
    }
    for (const product of products) {
      const inv = product.inventory;
      if (!inv?.isTracked) continue;
      const wantedMeters = metersByProduct.get(product.id);
      // A cut-to-length product is limited by its fabric, not its unit count.
      if (wantedMeters != null) {
        if (inv.metersAvailable != null && inv.metersAvailable < wantedMeters) {
          res.status(409).json({ success: false, message: `Insufficient fabric length for "${product.name}"` });
          return;
        }
        continue;
      }
      const wantedQty = qtyByProduct.get(product.id);
      if (wantedQty != null && inv.stockCount < wantedQty) {
        res.status(409).json({ success: false, message: `Insufficient stock for "${product.name}"` });
        return;
      }
    }

    // Validate the payment method up-front so online orders don't fail mid-transaction
    const isOnlinePayment = (mode === 'PICKUP' || mode === 'DELIVERY') && paymentMethod && paymentMethod !== 'PAY_AT_SHOP';
    if (isOnlinePayment && !PAYMENT_METHODS.includes(paymentMethod)) {
      res.status(400).json({ success: false, message: 'Invalid payment method' });
      return;
    }

    const subtotal = Math.round(goodsTotal);
    const discount = Math.max(0, Math.round(listTotal) - subtotal);
    const totalAmount = subtotal + (deliveryFeeAmount || 0);

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
          scheduledDeliveryDate:
            mode === 'DELIVERY' && deliveryType === 'SCHEDULED' && scheduledDeliveryDate
              ? new Date(scheduledDeliveryDate)
              : null,
          deliveryFee: deliveryFeeAmount,
          subtotal: subtotal > 0 ? subtotal : null,
          discount: discount > 0 ? discount : null,
          totalAmount: totalAmount > 0 ? totalAmount : null,
          paymentStatus: mode === 'RESERVATION' ? 'AWAITING' : 'PENDING',
          items: preparedItems.length > 0 ? {
            create: preparedItems.map((p) => ({
              productId: p.item.productId,
              quantity: p.priced.quantity,
              metersRequired: p.priced.meters,
              windowWidth: p.priced.widthCm,
              windowHeight: p.priced.dropCm,
              unitPrice: p.priced.unitPrice,
              totalPrice: p.priced.lineTotal || null,
              options: p.priced.options as unknown as Prisma.InputJsonValue,
              notes: p.item.notes || null,
            })),
          } : undefined,
          // First entry of the audit trail, so every order has a "placed at"
          // event and the customer timeline is never empty.
          statusHistory: {
            create: {
              status: 'PENDING',
              paymentStatus: mode === 'RESERVATION' ? 'AWAITING' : 'PENDING',
              note: 'Order placed',
              actor: req.user?.id ? `customer:${req.user.id}` : 'customer',
            },
          },
        },
        include: customerOrderInclude,
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

      // Decrement stock for tracked products, once per product rather than
      // once per line — the totals were summed for the availability check above.
      for (const product of products) {
        const inv = product.inventory;
        if (!inv?.isTracked) continue;
        const meters = metersByProduct.get(product.id);
        const invUpdate: { stockCount?: { decrement: number }; metersAvailable?: { decrement: number } } = {};
        if (meters != null && inv.metersAvailable != null) invUpdate.metersAvailable = { decrement: meters };
        else {
          const qty = qtyByProduct.get(product.id);
          if (qty != null) invUpdate.stockCount = { decrement: qty };
        }
        if (Object.keys(invUpdate).length > 0) {
          await tx.inventory.update({ where: { productId: product.id }, data: invUpdate });
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

    // Read the order back after the transaction. `created` was loaded before
    // the payment row existed — returning it would hand the confirmation screen
    // an order with an empty `payments` array and no reference to show.
    const fullOrder = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      include: customerOrderInclude,
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

    res.status(201).json({ success: true, data: fullOrder ?? reservation });
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
      include: customerOrderInclude,
    });
    if (!reservation) { res.status(404).json({ success: false, message: 'Reservation not found' }); return; }
    res.json({ success: true, data: reservation });
  } catch (error) {
    logger.error('GetReservation error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reservation' });
  }
};

// Guest lookup by name + phone (BOTH required, so a name alone can't reveal
// someone else's orders). Phone is matched on its significant digits so it works
// regardless of format (+250…, 078…, spaces).
export const lookupReservations = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.query.name || '').trim();
    const digits = String(req.query.phone || '').replace(/\D/g, '');
    if (name.length < 2 || digits.length < 6) {
      res.status(400).json({ success: false, message: 'Both name and phone number are required' });
      return;
    }
    const sig = digits.slice(-9);
    const reservations = await prisma.reservation.findMany({
      where: {
        customerName: { contains: name, mode: 'insensitive' },
        customerPhone: { contains: sig },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: customerOrderInclude,
    });
    res.json({ success: true, data: reservations });
  } catch (error) {
    logger.error('LookupReservations error:', error);
    res.status(500).json({ success: false, message: 'Failed to look up orders' });
  }
};

export const getMyReservations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        // `slug` lets the history page link each line back to its product.
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
        deliveryAddress: true,
        // Needed for the payment column: what was paid, how, and whether it
        // actually went through.
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            reference: true,
            createdAt: true,
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
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
    const { page = 1, limit = 20, status, search, date, fulfillmentType, paymentStatus } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = String(status);
    if (fulfillmentType) where.fulfillmentType = String(fulfillmentType);
    if (paymentStatus) where.paymentStatus = String(paymentStatus);
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
        { customerEmail: { contains: String(search), mode: 'insensitive' } },
        { reservationNumber: { contains: String(search), mode: 'insensitive' } },
        // Staff reconciling a mobile-money statement search by the payment
        // reference, which is not on the reservation itself.
        { payments: { some: { reference: { contains: String(search), mode: 'insensitive' } } } },
      ];
    }

    const { skip, take } = getPaginationParams(Number(page), Number(limit));
    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        // The manage drawer shows the full order — specs, money, payment and
        // history — without a second round trip per row.
        include: {
          items: { include: { product: { select: { id: true, name: true, slug: true, images: { where: { isPrimary: true }, take: 1 } } } } },
          deliveryAddress: true,
          payments: { orderBy: { createdAt: 'desc' } },
          statusHistory: { orderBy: { createdAt: 'asc' } },
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

// (Re)compute a pickup/delivery order's total from CURRENT product prices and
// sync the pending mobile-money payment. Run on confirmation so the customer's
// pay prompt shows the right amount even when the price was set AFTER ordering.
const recomputeReservationTotal = async (id: string): Promise<void> => {
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      items: { include: { product: { include: { category: { select: { name: true, slug: true } }, colors: true } } } },
      payments: true,
    },
  });
  if (!r || (r.fulfillmentType !== 'PICKUP' && r.fulfillmentType !== 'DELIVERY')) return;
  // Never overwrite an amount that's already been set (by the admin or a prior run).
  if (r.totalAmount != null && r.totalAmount > 0) return;

  // Re-price through the same module the checkout used, feeding back the
  // configuration that was stored on the line, so a price entered after the
  // order still produces the metres and totals the customer configured.
  let goods = 0;
  for (const it of r.items) {
    const priced = priceLine(
      it.product,
      {
        productId: it.productId,
        quantity: it.quantity,
        metersRequired: it.metersRequired,
        windowWidth: it.windowWidth,
        windowHeight: it.windowHeight,
        options: (it.options ?? {}) as Record<string, unknown>,
      }
    );
    goods += priced.lineTotal || it.totalPrice || 0;
  }
  const subtotal = Math.round(goods);
  const total = subtotal + (r.deliveryFee ?? 0);

  await prisma.reservation.update({
    where: { id },
    data: { subtotal: subtotal > 0 ? subtotal : null, totalAmount: total > 0 ? total : null },
  });

  const pending = r.payments.find(
    (pp) => pp.status === 'PENDING' && (pp.method === 'MTN_MOMO' || pp.method === 'AIRTEL_MONEY')
  );
  if (pending && total > 0) {
    await prisma.payment.update({ where: { id: pending.id }, data: { amount: total } });
  }
};

const VALID_PAYMENT_STATUSES = ['AWAITING', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];

export const updateReservationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, adminNotes, cancelReason, paymentStatus, totalAmount } = req.body;

    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      res.status(400).json({ success: false, message: 'Invalid payment status' });
      return;
    }

    // What it was before, so the history records real transitions only.
    const before = await prisma.reservation.findUnique({
      where: { id },
      select: { status: true, paymentStatus: true },
    });
    if (!before) {
      res.status(404).json({ success: false, message: 'Reservation not found' });
      return;
    }

    // Optional admin-set amount to charge (for products priced as a range).
    const amt = totalAmount !== undefined && totalAmount !== null && totalAmount !== ''
      ? Number(totalAmount) : undefined;
    if (amt !== undefined && (!Number.isFinite(amt) || amt < 0)) {
      res.status(400).json({ success: false, message: 'Invalid amount' });
      return;
    }

    // Auto-compute from product prices on confirm ONLY when the admin didn't set an amount.
    if (status === 'CONFIRMED' && amt === undefined) {
      await recomputeReservationTotal(id).catch((e) => logger.error('Recompute total on confirm failed:', e));
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        // Only touch the note when the caller actually sent the field —
        // "mark as paid" posts no note, and must not erase the message the
        // customer is being shown.
        ...(adminNotes !== undefined ? { adminNotes: adminNotes || null } : {}),
        ...(status === 'CANCELLED' ? { cancelReason: cancelReason || null } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(amt !== undefined ? { totalAmount: amt > 0 ? amt : null } : {}),
      },
    });

    // Keep the Payment record(s) in sync so verify/track reflect "Paid".
    if (paymentStatus) {
      await prisma.payment.updateMany({ where: { reservationId: id }, data: { status: paymentStatus } });
    }

    // Append to the audit trail — one row per real transition. Failing to log
    // must never fail the update itself.
    const statusChanged = !!status && status !== before.status;
    const paymentChanged = !!paymentStatus && paymentStatus !== before.paymentStatus;
    if (statusChanged || paymentChanged) {
      await prisma.reservationStatusEvent.create({
        data: {
          reservationId: id,
          status: statusChanged ? status : null,
          paymentStatus: paymentChanged ? paymentStatus : null,
          note: adminNotes || null,
          actor: req.user?.id ? `admin:${req.user.id}` : 'admin',
        },
      }).catch((e) => logger.error('Status history write failed:', e));
    }

    // When an amount is set on an online-payment order, make sure a pending
    // mobile-money payment exists with that amount, so the customer's pay button shows.
    if (amt !== undefined && amt > 0 && (reservation.fulfillmentType === 'PICKUP' || reservation.fulfillmentType === 'DELIVERY')) {
      const existing = await prisma.payment.findFirst({
        where: { reservationId: id, method: { in: ['MTN_MOMO', 'AIRTEL_MONEY'] } },
      });
      if (existing) {
        await prisma.payment.update({ where: { id: existing.id }, data: { amount: amt } });
      } else {
        await prisma.payment.create({
          data: {
            reservationId: id, method: 'MTN_MOMO', amount: amt, currency: 'RWF', status: 'PENDING',
            reference: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          },
        });
      }
    }

    // Only tell the customer when the status really moved. Marking a payment
    // as received re-sends the current status, and used to fire a duplicate
    // "your order is CONFIRMED" SMS every time.
    if (statusChanged) {
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
    }

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
    await prisma.reservationStatusEvent.create({
      data: {
        reservationId: id,
        status: 'CANCELLED',
        note: cancelReason || null,
        actor: isAdmin ? `admin:${req.user?.id}` : req.user?.id ? `customer:${req.user.id}` : 'customer',
      },
    }).catch((e) => logger.error('Cancel history write failed:', e));
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
