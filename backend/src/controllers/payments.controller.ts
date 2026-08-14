import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { DELIVERY_FEES } from '../utils/delivery';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';
import * as paypack from '../services/paypack.service';
import { sendSMS } from '../services/sms.service';

const PAYMENT_METHODS = [
  'MTN_MOMO', 'AIRTEL_MONEY', 'VISA', 'MASTERCARD', 'AMEX',
  'BANK_TRANSFER', 'FLUTTERWAVE', 'PAYPAL', 'STRIPE', 'PAY_AT_SHOP',
];

// Methods we route through the Paypack aggregator (mobile money). Everything
// else stays on the manual/offline path the shop reconciles by hand.
const GATEWAY_METHODS = ['MTN_MOMO', 'AIRTEL_MONEY'];

const newReference = () =>
  `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/**
 * Apply a settled Paypack status to our records — exactly once. Both the webhook
 * and the verify-poll can resolve the same transaction, so this is written to be
 * idempotent: a payment that already reached a terminal state is left alone.
 */
async function reconcilePayment(
  paymentId: string,
  status: paypack.PaypackStatus,
  gateway?: unknown,
): Promise<void> {
  const internal = paypack.toPaymentStatus(status);
  if (internal === 'PENDING') return; // nothing has settled yet

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { reservation: true },
  });
  if (!payment) return;
  if (payment.status === 'COMPLETED' || payment.status === 'FAILED') return;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: internal,
        gatewayResponse: gateway ? (gateway as Prisma.InputJsonValue) : undefined,
      },
    });
    await tx.reservation.update({
      where: { id: payment.reservationId },
      data: { paymentStatus: internal },
    });
    await tx.reservationStatusEvent.create({
      data: {
        reservationId: payment.reservationId,
        paymentStatus: internal,
        note: internal === 'COMPLETED' ? 'Payment received (Mobile Money)' : 'Payment failed (Mobile Money)',
        actor: 'system',
      },
    });
  });

  // Best-effort receipt SMS. Never let a notification failure undo a payment.
  if (internal === 'COMPLETED') {
    const { customerPhone, customerName, reservationNumber } = payment.reservation;
    const amt = Math.round(payment.amount).toLocaleString();
    sendSMS(
      customerPhone,
      `Hello ${customerName}! DENISE Textile received your payment of ${amt} RWF for order ${reservationNumber}. Murakoze!`,
    ).catch((e) => logger.error('Payment receipt SMS failed:', e));
  }
}

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
      include: { items: true, payments: true },
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

    // Reuse the PENDING payment the order flow already created, rather than
    // stacking a second row for the same order. Only create one if none exists
    // (e.g. an order placed as pay-at-shop that the customer now wants to pay).
    let payment = reservation.payments.find((p) => p.status === 'PENDING') ?? null;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          reservationId, method, amount: amountOwed, currency: 'RWF', status: 'PENDING',
          phoneNumber: phoneNumber || null, reference: newReference(),
        },
      });
    } else {
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          method,
          amount: amountOwed,
          phoneNumber: phoneNumber || payment.phoneNumber,
          reference: payment.reference ?? newReference(),
        },
      });
    }

    const isMobileMoney = GATEWAY_METHODS.includes(method);

    // ── Automated request-to-pay via Paypack ──────────────────────────────────
    if (isMobileMoney && paypack.isConfigured()) {
      if (!phoneNumber) {
        res.status(400).json({ success: false, message: 'A mobile money phone number is required' });
        return;
      }
      try {
        const tx = await paypack.cashin(amountOwed, phoneNumber, payment.reference!);
        // Store the gateway ref (so the webhook can find this payment) but leave
        // the status PENDING — reconcilePayment settles it consistently, whether
        // the result arrives now, via the poll, or via the webhook.
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerRef: tx.ref,
            gatewayResponse: tx as unknown as Prisma.InputJsonValue,
          },
        });
        // Handles the rare case where the charge already settled by the time
        // cashin returns (otherwise a no-op for a still-pending transaction).
        await reconcilePayment(payment.id, tx.status, tx);
        res.status(201).json({
          success: true,
          data: {
            paymentId: payment.id,
            reference: payment.reference,
            amount: amountOwed,
            status: 'PENDING',
            provider: 'paypack',
            // Tells the client to show the "check your phone / enter PIN" prompt
            // and start polling verify.
            requiresConfirmation: true,
          },
        });
        return;
      } catch (error) {
        logger.error('Paypack cashin error:', error);
        // Don't fail the payment permanently — let the client offer the manual
        // USSD dial as a fallback so an order is never stranded.
        res.status(502).json({
          success: false,
          message: 'Could not reach the mobile money service. Please try again or use the USSD option.',
          data: { reference: payment.reference, provider: 'paypack', requiresConfirmation: false },
        });
        return;
      }
    }

    // ── Manual path ────────────────────────────────────────────────────────────
    // Paypack not configured, or a non-mobile-money method: return the record so
    // the client shows the USSD dial / bank details and the shop reconciles.
    res.status(201).json({
      success: true,
      data: {
        paymentId: payment.id,
        reference: payment.reference,
        amount: amountOwed,
        status: payment.status,
        provider: 'manual',
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
      include: { reservation: { select: { reservationNumber: true, status: true, paymentStatus: true } } },
    });
    if (!payment) { res.status(404).json({ success: false, message: 'Payment not found' }); return; }

    // Still pending with a gateway transaction? Ask Paypack directly and settle
    // now, so the customer isn't left waiting on a delayed webhook.
    if (payment.status === 'PENDING' && payment.providerRef && paypack.isConfigured()) {
      try {
        const tx = await paypack.find(payment.providerRef);
        await reconcilePayment(payment.id, tx.status, tx);
        const fresh = await prisma.payment.findUnique({
          where: { id: payment.id },
          include: { reservation: { select: { reservationNumber: true, status: true, paymentStatus: true } } },
        });
        res.json({ success: true, data: fresh });
        return;
      } catch (error) {
        logger.error('Paypack verify error:', error);
        // Fall through and return the current (pending) state.
      }
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    logger.error('VerifyPayment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

/**
 * Paypack `transaction:processed` webhook. Mounted with a RAW body parser (see
 * index.ts) because a signature, when present, is computed over the exact bytes
 * sent — a re-serialised JSON body would not match.
 *
 * Trust model: the webhook payload is never trusted on its own to mark an order
 * paid. We only use it to learn *which* transaction changed, then confirm the
 * outcome one of two ways:
 *   • if PAYPACK_WEBHOOK_SECRET is set and the signature is valid → trust the
 *     payload status (fast path);
 *   • otherwise → re-verify against Paypack's authenticated API (`find`).
 * So a forged POST can, at worst, trigger an authenticated re-check of a
 * transaction we already own — it can never fake a payment.
 */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');

  let event: { data?: { ref?: string; status?: paypack.PaypackStatus } };
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    // Acknowledge malformed bodies so Paypack doesn't retry them forever.
    res.status(200).json({ success: true });
    return;
  }

  const ref = event?.data?.ref;
  if (ref) {
    // Only act on a transaction we actually issued and haven't settled yet.
    const payment = await prisma.payment.findUnique({ where: { providerRef: ref } });
    if (payment && payment.status === 'PENDING') {
      const signature = req.header('x-paypack-signature');
      const trusted = paypack.verifySignature(raw, signature);

      if (trusted && event.data?.status) {
        await reconcilePayment(payment.id, event.data.status, event.data).catch((e) =>
          logger.error('Webhook reconcile failed:', e),
        );
      } else if (paypack.isConfigured()) {
        // No usable signature — confirm authoritatively before doing anything.
        try {
          const tx = await paypack.find(ref);
          await reconcilePayment(payment.id, tx.status, tx);
        } catch (e) {
          logger.error('Webhook re-verify failed:', e);
        }
      }
    }
  }

  // Always acknowledge quickly so Paypack does not retry a handled event.
  res.status(200).json({ success: true });
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
