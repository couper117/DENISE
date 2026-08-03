import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { connectDB } from './config/database';
import { validateEnv } from './config/env';
import { generalLimiter } from './middleware/rateLimit.middleware';
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
import logger from './utils/logger';

const app = express();
// Behind Railway/Render's proxy: trust the first hop so req.protocol is 'https'
// (correct image URLs) and rate-limiting sees the real client IP.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serve locally-uploaded images (used when Cloudinary isn't configured)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(generalLimiter);

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

// Release scheduled publishes. A timer rather than a job runner because the API
// is a single long-lived process; each release clears scheduledAt, so a second
// instance would find nothing to do rather than double-publishing.
const SCHEDULE_TICK_MS = 60_000;
setInterval(() => {
  publishScheduled().catch((e) => logger.error('Scheduled publish failed:', e));
}, SCHEDULE_TICK_MS).unref();

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

const start = async () => {
  // Before the socket opens, so a misconfigured deploy fails its health check
  // instead of accepting traffic it cannot serve.
  validateEnv();

  app.listen(PORT, () => {
    logger.info(`DENISE Textile API running on port ${PORT}`);
  });
  connectDB().catch((err) => {
    logger.warn('Database unavailable — API running without DB:', err.message);
  });
};

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
