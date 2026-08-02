import { useEffect } from 'react';

const SITE_URL = 'https://deniseshop.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.svg`;

// Master keyword set — brand, English, French and Kinyarwanda terms we want to rank for.
export const DEFAULT_KEYWORDS = [
  'DENISE', 'Denise Shop', 'deniseshop', 'deniseshop.com', 'DENISE Textile', 'DENISE Rwanda',
  'New Textile Social Company',
  'Rwanda curtains', 'Kigali curtains', 'curtains Rwanda', 'buy curtains Kigali', 'curtain shop Kigali',
  'amarido', 'amarido Kigali', 'amarido Rwanda', 'rideaux Kigali', 'rideaux Rwanda',
  'imikenyero', 'imyenda gakondo', 'imishanana', 'umushanana', 'imyambaro ya kinyarwanda',
  'amatise', 'riba', 'ibidomeko', 'ibikoresho byo mu nzu',
  'interior design Rwanda', 'interior design Kigali', 'home decor Rwanda',
  'fabric shop Rwanda', 'textile shop Kigali', 'traditional Rwandan attire',
].join(', ');

interface SeoProps {
  title: string;
  description?: string;
  keywords?: string;
  /** Canonical path, e.g. "/products" or "/products/velvet-curtains". */
  path?: string;
  image?: string;
  type?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const upsert = (selector: string, make: () => HTMLElement, apply: (el: HTMLElement) => void) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) { el = make(); document.head.appendChild(el); }
  apply(el);
};

const metaName = (name: string, content: string) =>
  upsert(`meta[name="${name}"]`, () => { const m = document.createElement('meta'); m.setAttribute('name', name); return m; }, (el) => el.setAttribute('content', content));

const metaProp = (property: string, content: string) =>
  upsert(`meta[property="${property}"]`, () => { const m = document.createElement('meta'); m.setAttribute('property', property); return m; }, (el) => el.setAttribute('content', content));

const canonical = (href: string) =>
  upsert('link[rel="canonical"]', () => { const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l; }, (el) => el.setAttribute('href', href));

/**
 * Per-route SEO. Sets <title>, description, keywords, canonical, Open Graph,
 * Twitter tags and optional JSON-LD. Client-rendered (this is a Vite SPA), which
 * Googlebot executes — the static index.html supplies the crawl-time defaults.
 */
export default function Seo({ title, description, keywords, path = '', image, type = 'website', noindex = false, jsonLd }: SeoProps) {
  const jsonLdStr = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    const desc = description || '';
    const img = image || DEFAULT_IMAGE;

    document.title = title;
    if (desc) metaName('description', desc);
    metaName('keywords', keywords || DEFAULT_KEYWORDS);
    metaName('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    canonical(url);

    metaProp('og:title', title);
    if (desc) metaProp('og:description', desc);
    metaProp('og:url', url);
    metaProp('og:type', type);
    metaProp('og:image', img);
    metaName('twitter:title', title);
    if (desc) metaName('twitter:description', desc);
    metaName('twitter:image', img);

    const prev = document.head.querySelector('script[data-seo-jsonld]');
    if (prev) prev.remove();
    if (jsonLdStr) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-seo-jsonld', '');
      s.textContent = jsonLdStr;
      document.head.appendChild(s);
    }
  }, [title, description, keywords, path, image, type, noindex, jsonLdStr]);

  return null;
}
