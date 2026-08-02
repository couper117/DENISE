// ─── BUSINESS CONTACT INFO ────────────────────────────────────────────────────
// Update these values with your real phone number and email, then redeploy.

export const BUSINESS_PHONE       = '+250 788 878 487';   // ← YOUR REAL PHONE HERE
export const BUSINESS_PHONE_CLEAN = '250788878487';       // ← same number, no spaces/+
export const BUSINESS_EMAIL       = 'info@deniseshop.com';// ← YOUR REAL EMAIL HERE
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

// ─── MOBILE MONEY (MTN MoMo) ──────────────────────────────────────────────────
// The MTN MoMo number that RECEIVES customer payments. Digits only, no +.
export const MOMO_NUMBER = '250788878487'; // ← ⚠️ REPLACE with your real MTN MoMo number

// USSD template for MTN Rwanda "send money". {number} and {amount} are filled in.
// This replays the menu steps (Transfer → Send money → number → amount). If MTN
// changes the menu order, adjust the numbers here — nothing else needs to change.
export const MOMO_USSD_TEMPLATE = '*182*1*1*{number}*{amount}#';

/**
 * Build the dialable MoMo USSD for a given amount.
 * Returns the raw USSD (to show/copy) and a tel: href (# encoded as %23 so the
 * dialer accepts it). The customer taps → confirms DENISE + amount → enters PIN.
 */
export const buildMomoDial = (amount: number) => {
  const ussd = MOMO_USSD_TEMPLATE
    .replace('{number}', MOMO_NUMBER)
    .replace('{amount}', String(Math.max(0, Math.round(amount))));
  return { ussd, href: `tel:${ussd.replace(/#/g, '%23')}` };
};
