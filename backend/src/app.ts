// Settings: Vercel injects them; locally src/index.ts loads .env before this file.
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { readLimiter, writeLimiter } from './middleware/rateLimit.middleware';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import reservationRoutes from './routes/reservation.routes';
import categoryRoutes from './routes/category.routes';
import blogRoutes from './routes/blog.routes';
import adminRoutes from './routes/admin.routes';
import wishlistRoutes from './routes/wishlist.routes';
import reviewsRoutes from './routes/reviews.routes';
import paymentsRoutes from './routes/payments.routes';
import deliveryRoutes from './routes/delivery.routes';
import contentRoutes from './routes/content.routes';
import cmsRoutes from './routes/cms.routes';
import mediaRoutes from './routes/media.routes';
import { publishScheduled } from './controllers/cms.controller';
import { handleWebhook } from './controllers/payments.controller';
import logger from './utils/logger';
import prisma from './config/database';
import { validateEnv } from './config/env';

// On Vercel this module *is* the server (Vercel's Express support serves the
// default export below), so the secret check that index.ts runs before
// listening happens here, once per cold start, and fails loudly in the logs.
if (process.env.VERCEL) validateEnv();

const app = express();
// Behind Railway/Render's proxy: trust the first hop so req.protocol is 'https'
// (correct image URLs) and rate-limiting sees the real client IP.
app.set('trust proxy', 1);

// Build allowed origins list from env. Normalise (drop trailing slash) and, for
// each configured site, allow BOTH the apex and the www host so a redirect
// either way — or a stray trailing slash in the env var — doesn't break CORS.
const normalizeOrigin = (o: string): string => o.trim().replace(/\/+$/, '');

const expandOrigin = (o: string): string[] => {
  const clean = normalizeOrigin(o);
  try {
    const u = new URL(clean);
    const bareHost = u.host.replace(/^www\./, '');
    return [`${u.protocol}//${bareHost}`, `${u.protocol}//www.${bareHost}`];
  } catch {
    return [clean];
  }
};

const allowedOrigins = [...new Set(
  [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_ALT,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
  ]
    .filter(Boolean)
    .flatMap((o) => expandOrigin(o as string))
)];

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
    // Reject cleanly (no ACAO header) instead of throwing, so a blocked origin
    // gets a normal CORS failure rather than a 500 from the error handler.
    logger.warn(`CORS blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware
app.use(compression());
app.use(cookieParser());

// Paypack payment webhook. Mounted BEFORE express.json with a raw-body parser:
// the webhook signature is an HMAC over the exact bytes Paypack sent, so the
// body must not be parsed and re-serialised before we verify it.
app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), handleWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serve locally-uploaded images (used when Cloudinary isn't configured)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(readLimiter, writeLimiter);

// Public catalogue reads are the same for every visitor, so Vercel's CDN may
// serve them for 60 s (and a stale copy for up to 10 min while it refreshes).
// A burst of shoppers then costs the database about one query per URL per
// minute instead of one per visitor — the free Postgres plan allows only 20
// connections. Only successful responses, only anonymous requests (an admin
// with a token always gets fresh data), never orders, payments or accounts.
const CDN_CACHEABLE = [
  /^\/api\/products(\/|$)/, /^\/api\/categories\/?$/, /^\/api\/cms\/(content|settings)\/?$/,
  /^\/api\/(testimonials|faqs)\/?$/, /^\/api\/delivery\/(zones|fee)\/?$/, /^\/api\/reviews\//,
  /^\/api\/blogs(\/|$)/, /^\/api\/payments\/delivery-fees\/?$/, /^\/sitemap\.xml$/,
];
app.use((req, res, next) => {
  const cacheable = (req.method === 'GET' || req.method === 'HEAD')
    && !req.headers.authorization
    && CDN_CACHEABLE.some((pattern) => pattern.test(req.path));
  if (cacheable) {
    const writeHead = res.writeHead;
    res.writeHead = function (this: express.Response, statusCode: number, ...rest: unknown[]) {
      if (statusCode >= 200 && statusCode < 300 && !this.getHeader('Cache-Control')) {
        this.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
      }
      return (writeHead as (...args: unknown[]) => express.Response).call(this, statusCode, ...rest);
    } as typeof res.writeHead;
  }
  next();
});

// Release scheduled publishes. A long-running server does this on a timer
// (see index.ts). On Vercel nothing runs between requests, so the check rides
// on incoming traffic instead, at most once a minute per instance; each
// release clears scheduledAt, so overlapping checks cannot double-publish.
if (process.env.VERCEL) {
  let lastScheduleCheck = 0;
  app.use((_req, _res, next) => {
    const now = Date.now();
    if (now - lastScheduleCheck > 60_000) {
      lastScheduleCheck = now;
      publishScheduled().catch((e) => logger.error('Scheduled publish failed:', e));
    }
    next();
  });
}


// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'DENISE Textile API' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api', contentRoutes); // public: /api/testimonials, /api/faqs
app.use('/api/cms', cmsRoutes); // visual CMS: content blocks + site settings
app.use('/api/media', mediaRoutes); // visual CMS: media library

// Sitemap for search engines, built from the catalogue so every product,
// category and blog post is listed the moment it exists. The storefront
// (Vercel project "denise") rewrites www.deniseshop.com/sitemap.xml to here.
// CDN-cached for a minute like the rest of the public catalogue.
const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://www.deniseshop.com').replace(/\/+$/, '');
const xmlEscape = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

app.get('/sitemap.xml', async (_req, res) => {
  try {
    const [products, categories, blogs] = await Promise.all([
      prisma.product.findMany({ where: { isAvailable: true }, select: { slug: true, updatedAt: true, images: { select: { url: true }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1 } } }),
      prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
      prisma.blog.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    ]);
    const day = (d?: Date) => (d ?? new Date()).toISOString().slice(0, 10);
    const entry = (path: string, opts: { lastmod?: Date; freq: string; priority: string; image?: string }) =>
      `  <url><loc>${xmlEscape(SITE_URL + path)}</loc><lastmod>${day(opts.lastmod)}</lastmod><changefreq>${opts.freq}</changefreq><priority>${opts.priority}</priority>${
        opts.image && /^https?:\/\//.test(opts.image) ? `<image:image><image:loc>${xmlEscape(opts.image)}</image:loc></image:image>` : ''
      }</url>`;
    const urls = [
      entry('/', { freq: 'daily', priority: '1.0' }),
      entry('/products', { freq: 'daily', priority: '0.9' }),
      ...categories.map((c) => entry(`/products?category=${c.slug}`, { lastmod: c.updatedAt, freq: 'weekly', priority: '0.8' })),
      ...products.map((p) => entry(`/products/${p.slug}`, { lastmod: p.updatedAt, freq: 'weekly', priority: '0.8', image: p.images[0]?.url })),
      entry('/about', { freq: 'monthly', priority: '0.6' }),
      entry('/contact', { freq: 'monthly', priority: '0.6' }),
      entry('/blog', { freq: 'weekly', priority: '0.5' }),
      ...blogs.map((b) => entry(`/blog/${b.slug}`, { lastmod: b.updatedAt, freq: 'monthly', priority: '0.5' })),
      entry('/track', { freq: 'yearly', priority: '0.3' }),
    ];
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`
    );
  } catch (err) {
    logger.error('Sitemap failed:', err);
    res.status(503).type('text/plain').send('Sitemap temporarily unavailable');
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;
