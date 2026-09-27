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

// Dynamic sitemap
app.get('/sitemap.xml', (_req, res) => {
  const base = process.env.FRONTEND_URL || 'https://denise-textile.com';
  res.header('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/products</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${base}/reservation</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${base}/about</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${base}/contact</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>${base}/blog</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>
  <url><loc>${base}/track</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
</urlset>`);
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
