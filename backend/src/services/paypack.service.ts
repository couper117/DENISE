/**
 * Paypack (https://paypack.rw) mobile-money integration — the aggregator that
 * lets us take MTN MoMo and Airtel Money with a single API and one merchant
 * account, instead of onboarding each network's Collections API separately.
 *
 * The flow this file supports:
 *   1. `cashin()` sends a request-to-pay — the customer's phone lights up with a
 *      MoMo prompt and they confirm with their PIN.
 *   2. Paypack tells us the result two ways, and we use both for resilience:
 *        • the `transaction:processed` webhook (fast path, see verifySignature)
 *        • polling `find()` (fallback, in case the webhook is delayed or the URL
 *          isn't reachable in a given environment)
 *
 * Everything is a no-op-friendly wrapper: `isConfigured()` is false until the
 * PAYPACK_* secrets are set, so the rest of the app can fall back to the manual
 * USSD-dial flow and nothing breaks before the credentials land.
 */

import crypto from 'crypto';
import logger from '../utils/logger';

const BASE_URL = process.env.PAYPACK_BASE_URL || 'https://payments.paypack.rw/api';
// Paypack scopes transactions to an environment; webhooks and the dashboard
// filter on it. Development lets us test without touching real money.
const MODE = process.env.PAYPACK_MODE === 'production' ? 'production' : 'development';

const CLIENT_ID = process.env.PAYPACK_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PAYPACK_CLIENT_SECRET || '';
const WEBHOOK_SECRET = process.env.PAYPACK_WEBHOOK_SECRET || '';

/** True once the merchant credentials are present. Callers fall back to the
 *  manual USSD flow while this is false. */
export const isConfigured = (): boolean => Boolean(CLIENT_ID && CLIENT_SECRET);

export type PaypackStatus = 'pending' | 'successful' | 'failed';

export interface PaypackTransaction {
  ref: string;
  status: PaypackStatus;
  amount: number;
  kind?: string;
  provider?: string;
  client?: string;
}

// ── Access-token cache ────────────────────────────────────────────────────────
// Access tokens last ~15 minutes. We cache one in memory and refresh a little
// early, rather than authenticating on every request.
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const authorize = async (): Promise<string> => {
  const res = await fetch(`${BASE_URL}/auth/agents/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Paypack auth failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access: string; expires?: number };
  cachedToken = data.access;
  // Refresh 60s before the real expiry; default to 14 min if `expires` is absent.
  const ttlMs = (data.expires ? data.expires * 1000 : 14 * 60_000);
  tokenExpiresAt = Date.now() + ttlMs - 60_000;
  return cachedToken;
};

const getToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return authorize();
};

/** Normalise a Rwandan number to Paypack's expected local form: 07XXXXXXXX. */
export const normalizePhone = (raw: string): string => {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('250')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  if (digits.length === 9) return `0${digits}`;
  return digits;
};

/**
 * Send a request-to-pay. `idempotencyKey` (our payment reference) makes a
 * retried call safe — Paypack returns the original transaction rather than
 * charging twice. Returns the Paypack `ref`, which we store to reconcile later.
 */
export const cashin = async (
  amount: number,
  phone: string,
  idempotencyKey: string,
): Promise<PaypackTransaction> => {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/transactions/cashin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      // Max 32 chars per Paypack; our PAY-<ts>-<rand> references fit.
      'Idempotency-Key': idempotencyKey.slice(0, 32),
      'X-Webhook-Mode': MODE,
    },
    body: JSON.stringify({ amount: Math.round(amount), number: normalizePhone(phone) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Paypack cashin failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as PaypackTransaction;
};

/** Look up a transaction's current status by its Paypack ref. */
export const find = async (ref: string): Promise<PaypackTransaction> => {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/transactions/find/${encodeURIComponent(ref)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Paypack find failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as PaypackTransaction;
};

/**
 * Verify a webhook came from Paypack: base64(HMAC-SHA256(rawBody, webhookSecret))
 * must equal the `x-paypack-signature` header. Uses the raw request bytes — the
 * signature is over exactly what was sent, so the body must not be re-serialised
 * (this is why the webhook route parses a raw body, not JSON).
 */
export const verifySignature = (rawBody: Buffer | string, signature?: string): boolean => {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('base64');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

/** Map a Paypack status to our internal PaymentStatus. */
export const toPaymentStatus = (status: PaypackStatus): 'PENDING' | 'COMPLETED' | 'FAILED' => {
  if (status === 'successful') return 'COMPLETED';
  if (status === 'failed') return 'FAILED';
  return 'PENDING';
};

export const paypackMode = (): string => MODE;

// A tiny startup breadcrumb so a deploy without credentials is obvious in logs
// rather than silently falling back.
if (!isConfigured()) {
  logger.warn('Paypack not configured — mobile-money payments fall back to manual USSD dial.');
}
