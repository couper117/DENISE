// ─── BUSINESS CONTACT INFO ────────────────────────────────────────────────────
// Update these values with your real phone number and email, then redeploy.

export const BUSINESS_PHONE       = '+250 788 878 487';   // ← YOUR REAL PHONE HERE
export const BUSINESS_PHONE_CLEAN = '250788878487';       // ← same number, no spaces/+
export const BUSINESS_EMAIL       = 'kelvin2028010@gmail.com';
export const BUSINESS_WHATSAPP    = '250788878487';       // ← WhatsApp number (digits only)
export const BUSINESS_ADDRESS     = 'Kigali, Rwanda';
export const BUSINESS_LAT         = -1.9441;              // ← shop coordinates (for maps)
export const BUSINESS_LNG         = 30.0619;
export const BUSINESS_HOURS       = 'Mon–Sat: 8:00 AM – 6:00 PM';
export const BUSINESS_NAME        = 'DENISE Textile';
export const BUSINESS_FULL_NAME   = 'New Textile Social Company Limited';
export const WEBSITE_URL          = 'https://deniseshop.com';

export const SOCIAL_LINKS = {
  facebook:  'https://www.facebook.com/denisetextile',  // ← update with real URL
  instagram: 'https://www.instagram.com/denisetextile', // ← update with real URL
  twitter:   '',
};

export const WHATSAPP_MESSAGE = encodeURIComponent(
  'Hello DENISE Textile! I would like to learn more about your products.'
);

export const WHATSAPP_LINK = `https://wa.me/${BUSINESS_WHATSAPP}?text=${WHATSAPP_MESSAGE}`;

// ─── MOBILE MONEY (USSD pay) ──────────────────────────────────────────────────
// Numbers that RECEIVE customer payments (digits only, no +). Each provider's
// USSD template replays the "send money" menu steps; {number} and {amount} are
// filled in. If a network changes its menu order, adjust the numbers in the
// template — nothing else needs to change.

// MTN Mobile Money — send-money menu: *182# → 1 (transfer) → 1 (uri muri MoMo)
// → number → amount → (confirm + PIN). Two 1s.
export const MOMO_NUMBER = '250788878487';
export const MOMO_USSD_TEMPLATE = '*182*1*1*{number}*{amount}#';

// Airtel Money
export const AIRTEL_NUMBER = '250730000000'; // ← ⚠️ REPLACE with your real Airtel Money number
export const AIRTEL_USSD_TEMPLATE = '*500*1*1*{number}*{amount}#';

// Airtel is only offered once a real number is set — until then it stays hidden
// so customers don't dial the placeholder above.
export const AIRTEL_ENABLED = AIRTEL_NUMBER !== '250730000000' && /^\d{9,}$/.test(AIRTEL_NUMBER);

// ─── OTHER PAYMENT METHODS ────────────────────────────────────────────────────
// Same pattern as AIRTEL_ENABLED: a method is only offered at checkout once the
// shop can actually honour it. Flip a flag to true when that becomes so.

/** Card payments need a gateway. `POST /api/payments/initiate` still carries a
 *  "TODO: integrate with actual payment gateway" — offering a card button before
 *  then would take an order the shop cannot charge. */
export const CARD_ENABLED = false;

/** Bank transfer needs no integration: the customer is told the team will send
 *  account details once the order is confirmed. */
export const BANK_TRANSFER_ENABLED = true;

/** Paying in person — at the shop for a pickup/reservation, to the courier on
 *  delivery. Maps to the PAY_AT_SHOP method the API already accepts. */
export const PAY_ON_COLLECTION_ENABLED = true;

export type MobileMoneyMethod = 'MTN_MOMO' | 'AIRTEL_MONEY';

export const MOBILE_MONEY = {
  MTN_MOMO: { label: 'MTN MoMo', number: MOMO_NUMBER, template: MOMO_USSD_TEMPLATE },
  AIRTEL_MONEY: { label: 'Airtel Money', number: AIRTEL_NUMBER, template: AIRTEL_USSD_TEMPLATE },
} as const;

/**
 * Build the dialable USSD for a mobile-money payment. Returns the raw USSD (to
 * show/copy) and a tel: href (# encoded as %23 so the dialer accepts it). The
 * customer taps → confirms DENISE + amount → enters PIN.
 */
export const buildMobileMoneyDial = (method: MobileMoneyMethod, amount: number) => {
  const { label, number, template } = MOBILE_MONEY[method];
  const ussd = template
    .replace('{number}', number)
    .replace('{amount}', String(Math.max(0, Math.round(amount))));
  return { label, ussd, href: `tel:${ussd.replace(/#/g, '%23')}` };
};
