import { create } from 'zustand';
import {
  AIRTEL_NUMBER, AIRTEL_USSD_TEMPLATE, BANK_TRANSFER_ENABLED, BUSINESS_ADDRESS, BUSINESS_EMAIL, BUSINESS_FULL_NAME,
  BUSINESS_HOURS, BUSINESS_LAT, BUSINESS_LNG, BUSINESS_NAME, BUSINESS_PHONE, BUSINESS_WHATSAPP, CARD_ENABLED,
  MOMO_NUMBER, MOMO_USSD_TEMPLATE, MobileMoneyMethod, PAY_ON_COLLECTION_ENABLED, SOCIAL_LINKS, WEBSITE_URL,
} from './config';

/**
 * Business details the owner can change from Admin → Settings, without a
 * developer: shop name, logo, phone, WhatsApp, email, address, hours, map
 * position, social links, payment numbers and which payment methods are
 * offered, and the same-day delivery surcharge.
 *
 * Values come from the `SiteSetting` table (public keys, loaded with the CMS
 * settings). Anything not set falls back to `lib/config.ts`, so an empty
 * database shows the site exactly as before. The last values seen are cached
 * in this browser so returning visitors never see the old ones flash first.
 *
 * Delivery fees per province are not here: they are the delivery zones the
 * server charges from (Admin → Settings → Delivery).
 */

export interface BusinessConfig {
  name: string;
  legalName: string;
  logo: string;
  phone: string;
  /** Digits only, international (2507…) — for tel: links. */
  phoneDigits: string;
  whatsapp: string;
  whatsappLink: string;
  email: string;
  address: string;
  hours: string;
  lat: number;
  lng: number;
  website: string;
  social: { facebook: string; instagram: string; twitter: string; tiktok: string };
  momoNumber: string;
  airtelNumber: string;
  airtelEnabled: boolean;
  bankEnabled: boolean;
  payInPersonEnabled: boolean;
  cardEnabled: boolean;
  bankDetails: string;
  sameDaySurcharge: number;
}

/** The setting keys this module reads — mirrored in the API's public list. */
export const BUSINESS_SETTING_KEYS = [
  'site.name', 'site.legalName', 'site.logo',
  'contact.phone', 'contact.whatsapp', 'contact.email', 'contact.address', 'contact.hours', 'contact.lat', 'contact.lng',
  'social.facebook', 'social.instagram', 'social.twitter', 'social.tiktok',
  'payment.momoNumber', 'payment.airtelNumber', 'payment.airtelEnabled', 'payment.bankEnabled', 'payment.payInPersonEnabled', 'payment.bankDetails',
  'delivery.sameDaySurcharge',
] as const;

const digits = (v: string) => v.replace(/\D/g, '');
/** 0788… → 250788…; 788… → 250788…; already international stays. */
export const toIntl = (v: string) => {
  const d = digits(v);
  if (d.startsWith('250')) return d;
  if (d.startsWith('0')) return `250${d.slice(1)}`;
  return d.length === 9 ? `250${d}` : d;
};

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const num = (v: unknown, fallback: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

const AIRTEL_PLACEHOLDER = '250730000000';

export const buildBusiness = (s: Record<string, unknown> = {}): BusinessConfig => {
  const name = str(s['site.name'], BUSINESS_NAME);
  const phone = str(s['contact.phone'], BUSINESS_PHONE);
  const whatsapp = toIntl(str(s['contact.whatsapp'], BUSINESS_WHATSAPP));
  const airtelNumber = toIntl(str(s['payment.airtelNumber'], AIRTEL_NUMBER));
  const message = encodeURIComponent(`Hello ${name}! I would like to learn more about your products.`);
  return {
    name,
    legalName: str(s['site.legalName'], BUSINESS_FULL_NAME),
    logo: str(s['site.logo'], ''),
    phone,
    phoneDigits: toIntl(phone),
    whatsapp,
    whatsappLink: `https://wa.me/${whatsapp}?text=${message}`,
    email: str(s['contact.email'], BUSINESS_EMAIL),
    address: str(s['contact.address'], BUSINESS_ADDRESS),
    hours: str(s['contact.hours'], BUSINESS_HOURS),
    lat: num(s['contact.lat'], BUSINESS_LAT),
    lng: num(s['contact.lng'], BUSINESS_LNG),
    website: WEBSITE_URL,
    social: {
      facebook: str(s['social.facebook'], SOCIAL_LINKS.facebook),
      instagram: str(s['social.instagram'], SOCIAL_LINKS.instagram),
      twitter: str(s['social.twitter'], SOCIAL_LINKS.twitter),
      tiktok: str(s['social.tiktok'], ''),
    },
    momoNumber: toIntl(str(s['payment.momoNumber'], MOMO_NUMBER)),
    airtelNumber,
    // Airtel is only offered with a real number, never the placeholder.
    airtelEnabled: bool(s['payment.airtelEnabled'], true) && airtelNumber !== AIRTEL_PLACEHOLDER && /^\d{9,}$/.test(airtelNumber),
    bankEnabled: bool(s['payment.bankEnabled'], BANK_TRANSFER_ENABLED),
    payInPersonEnabled: bool(s['payment.payInPersonEnabled'], PAY_ON_COLLECTION_ENABLED),
    cardEnabled: CARD_ENABLED, // no card gateway yet — not an admin switch
    bankDetails: str(s['payment.bankDetails'], ''),
    sameDaySurcharge: Math.max(0, num(s['delivery.sameDaySurcharge'], 1000)),
  };
};

/** Dialable USSD for a mobile-money payment, from the current numbers. */
export const buildDial = (biz: BusinessConfig, method: MobileMoneyMethod, amount: number) => {
  const momo = method === 'MTN_MOMO';
  const ussd = (momo ? MOMO_USSD_TEMPLATE : AIRTEL_USSD_TEMPLATE)
    .replace('{number}', momo ? biz.momoNumber : biz.airtelNumber)
    .replace('{amount}', String(Math.max(0, Math.round(amount))));
  return { label: momo ? 'MTN MoMo' : 'Airtel Money', ussd, href: `tel:${ussd.replace(/#/g, '%23')}` };
};

const CACHE_KEY = 'denise-site-settings';
const readCache = (): Record<string, unknown> => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};

interface SiteConfigState {
  biz: BusinessConfig;
  apply: (settings: Record<string, unknown>) => void;
}

export const useSiteConfig = create<SiteConfigState>((set) => ({
  biz: buildBusiness(readCache()),
  apply: (settings) => {
    const picked: Record<string, unknown> = {};
    for (const k of BUSINESS_SETTING_KEYS) if (k in settings) picked[k] = settings[k];
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(picked)); } catch { /* private mode */ }
    set({ biz: buildBusiness(picked) });
  },
}));

/** Current business details for components. */
export const useBusiness = () => useSiteConfig((s) => s.biz);
