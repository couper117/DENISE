/**
 * Search-engine and link-preview HTML for product and catalogue pages.
 *
 * The storefront is a single-page app: every URL is served the same
 * index.html, whose <head> describes the homepage until JavaScript runs.
 * Google renders JavaScript, but WhatsApp / Facebook previews and several
 * crawlers only read that first HTML. vercel.json rewrites /products and
 * /products/:slug here; this function returns the same index.html with the
 * page's own title, description, image, canonical URL and structured data
 * already in <head>. The app then boots exactly as it would from index.html.
 *
 * It never breaks the page: if the API is unreachable the untouched
 * index.html is returned.
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://www.deniseshop.com';
const API = (process.env.VITE_API_URL || 'https://denise-api.vercel.app/api').replace(/\/+$/, '');
const DEFAULT_IMAGE = `${SITE}/og-image.jpg`;

/** Titles for the categories people search for, in their own words. */
const CATEGORY_COPY = {
  curtains: {
    title: 'Curtains (amarido) in Kigali — night & day curtains made to measure | DENISE Textile',
    description: 'Buy curtains in Rwanda: rideau de nuit and rideau du jour made to your window size, with the rod. Enter your measurements online, pay with MTN MoMo, delivery across Rwanda.',
  },
  'hard-curtains': {
    title: 'Night curtains (rideau de nuit, amarido) in Kigali | DENISE Textile',
    description: 'Heavy night curtains — blackout, velvet and jacquard — made to measure in Kigali. We calculate the metres from your window size. Delivery across Rwanda.',
  },
  'soft-curtains': {
    title: 'Day curtains (rideau du jour, voile) in Kigali | DENISE Textile',
    description: 'Light day curtains and sheers (voile) made to measure in Kigali. Pair them with a night curtain; we size the rod for both. Pay with MTN MoMo.',
  },
  'curtain-rods': {
    title: 'Curtain rods (tringles) in Kigali — sized to your window | DENISE Textile',
    description: 'Curtain rods and double rods for night and day curtains, cut to your window width. Order online with delivery across Rwanda.',
  },
  fabrics: {
    title: 'Fabrics by the metre in Kigali — kitenge, wax & more | DENISE Textile',
    description: 'Buy fabric by the metre in Rwanda: kitenge, wax print and quality fabrics for clothing and décor. Choose your metres online, pay with MTN MoMo.',
  },
  'traditional-attire': {
    title: 'Rwandan traditional attire fabric — umushanana, imikenyero | DENISE Textile',
    description: 'Fabric for umushanana, imikenyero and imyenda gakondo — a standard 4 m outfit or your own length. Order online in Kigali, delivery across Rwanda.',
  },
};

let templateCache = null;

/** The built index.html: bundled with the function (vercel.json includeFiles), or fetched as a fallback. */
const loadTemplate = async (host) => {
  if (templateCache) return templateCache;
  for (const candidate of [path.join(process.cwd(), 'dist', 'index.html'), path.join(__dirname, '..', 'dist', 'index.html')]) {
    try { templateCache = fs.readFileSync(candidate, 'utf8'); return templateCache; } catch { /* try next */ }
  }
  const res = await fetch(`https://${host || 'www.deniseshop.com'}/index.html`);
  templateCache = await res.text();
  return templateCache;
};

const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (v, n) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s; };
const stripParens = (v) => String(v ?? '').replace(/\s*\(.*\)\s*$/, '');

const getJson = async (url) => {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()).data;
};

/** Replace one tag's attribute value, matched by a selector-like regex. */
const setMeta = (html, attr, key, value) => {
  const re = new RegExp(`(<meta\\s+${attr}="${key.replace(/[:.]/g, '\\$&')}"\\s+content=")[^"]*(")`, 'i');
  return re.test(html) ? html.replace(re, `$1${escapeHtml(value)}$2`) : html.replace('</head>', `    <meta ${attr}="${key}" content="${escapeHtml(value)}" />\n  </head>`);
};

const render = (template, page) => {
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = setMeta(html, 'name', 'description', page.description);
  html = setMeta(html, 'property', 'og:title', page.title);
  html = setMeta(html, 'property', 'og:description', page.description);
  html = setMeta(html, 'property', 'og:url', page.url);
  html = setMeta(html, 'property', 'og:type', page.type || 'website');
  html = setMeta(html, 'property', 'og:image', page.image || DEFAULT_IMAGE);
  html = setMeta(html, 'property', 'og:image:alt', page.imageAlt || page.title);
  html = setMeta(html, 'name', 'twitter:title', page.title);
  html = setMeta(html, 'name', 'twitter:description', page.description);
  html = setMeta(html, 'name', 'twitter:image', page.image || DEFAULT_IMAGE);
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${escapeHtml(page.url)}$2`);
  if (page.noindex) html = setMeta(html, 'name', 'robots', 'noindex, follow');
  if (page.jsonLd) {
    // "<" is escaped so no value can close the script tag.
    const ld = JSON.stringify(page.jsonLd).replace(/</g, '\\u003c');
    html = html.replace('</head>', `    <script type="application/ld+json">${ld}</script>\n  </head>`);
  }
  return html;
};

const productPage = async (slug) => {
  const p = await getJson(`${API}/products/${encodeURIComponent(slug)}`);
  if (!p) return null;
  const image = (p.images || []).find((i) => i.isPrimary)?.url || p.images?.[0]?.url;
  const cat = p.category;
  const catName = stripParens(cat?.name);
  const price = p.pricePerMeter != null ? `${Number(p.pricePerMeter).toLocaleString('en-US')} RWF per metre`
    : (p.salePrice ?? p.price) != null ? `${Number(p.salePrice ?? p.price).toLocaleString('en-US')} RWF` : null;
  const url = `${SITE}/products/${p.slug}`;
  const description = clip(
    `${p.name}${catName ? ` — ${catName}` : ''}${price ? `, ${price}` : ''}. ${p.description || ''} Order online with delivery across Rwanda or visit our shop in Kigali.`,
    160
  );
  const offerPrice = p.pricePerMeter ?? p.salePrice ?? p.price;
  return {
    title: `${p.name}${catName ? ` — ${catName}` : ''} in Kigali | DENISE Textile`,
    description,
    url,
    type: 'product',
    image: image && /^https?:\/\//.test(image) ? image : undefined,
    imageAlt: p.name,
    noindex: !p.isAvailable,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: clip(p.description || p.name, 500),
        image: image && /^https?:\/\//.test(image) ? [image] : undefined,
        sku: p.id,
        brand: { '@type': 'Brand', name: 'DENISE Textile' },
        category: cat?.name,
        ...(offerPrice != null ? {
          offers: {
            '@type': 'Offer',
            url,
            priceCurrency: p.currency || 'RWF',
            price: offerPrice,
            ...(p.pricePerMeter != null ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: p.pricePerMeter, priceCurrency: p.currency || 'RWF', unitCode: 'MTR', unitText: 'metre' } } : {}),
            availability: p.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: 'DENISE Textile' },
          },
        } : {}),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Products', item: `${SITE}/products` },
          ...(cat ? [{ '@type': 'ListItem', position: 3, name: cat.name, item: `${SITE}/products?category=${cat.slug}` }] : []),
          { '@type': 'ListItem', position: cat ? 4 : 3, name: p.name, item: url },
        ],
      },
    ],
  };
};

const listPage = async (categorySlug) => {
  if (!categorySlug) {
    return {
      title: 'Shop curtains, fabrics & traditional attire in Kigali | DENISE Textile',
      description: 'Curtains (amarido) made to measure — rideau de nuit and rideau du jour — curtain rods, fabrics by the metre and Rwandan traditional attire. Pay with MTN MoMo, delivery across Rwanda.',
      url: `${SITE}/products`,
    };
  }
  const categories = await getJson(`${API}/categories`);
  const all = (categories || []).flatMap((c) => [c, ...(c.children || [])]);
  const cat = all.find((c) => c.slug === categorySlug);
  if (!cat) return null;
  const copy = CATEGORY_COPY[cat.slug];
  return {
    title: copy?.title || `${stripParens(cat.name)} in Kigali | DENISE Textile`,
    description: copy?.description || clip(`${cat.name}${cat.description ? ` — ${cat.description}` : ''}. Order online from DENISE Textile in Kigali with delivery across Rwanda.`, 160),
    url: `${SITE}/products?category=${cat.slug}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: cat.name,
      url: `${SITE}/products?category=${cat.slug}`,
      isPartOf: { '@type': 'WebSite', name: 'DENISE Textile', url: `${SITE}/` },
    },
  };
};

module.exports = async (req, res) => {
  let template;
  try {
    template = await loadTemplate(req.headers.host);
  } catch {
    res.statusCode = 502;
    res.end('Temporarily unavailable');
    return;
  }

  let page = null;
  let status = 200;
  try {
    const kind = req.query.kind;
    page = kind === 'product' ? await productPage(String(req.query.slug || '')) : await listPage(req.query.category ? String(req.query.category) : '');
    if (!page) {
      status = 404;
      page = { title: 'Page not found | DENISE Textile', description: 'This page no longer exists. Browse curtains, fabrics and traditional attire at DENISE Textile, Kigali.', url: `${SITE}/products`, noindex: true };
    }
  } catch (err) {
    // API unreachable: serve the plain app shell rather than an error page.
    console.error('SEO render failed:', err && err.message);
    page = null;
  }

  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Pages change when the admin edits products; five minutes is fresh enough
  // for search engines and link previews, and keeps this function rarely hit.
  res.setHeader('Cache-Control', page ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400' : 'public, max-age=0, s-maxage=30');
  res.end(page ? render(template, page) : template);
};
