import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Site-wide limits, applied to every /api request in index.ts. Reads and
 * writes are counted separately: one product page makes ~7 GET calls, and
 * Rwandan mobile networks put many customers behind one shared IP (CGNAT), so
 * a read budget sized like `generalLimiter` blocked real shoppers after a
 * dozen pages. Writes stay tight; login, orders, payments and reviews keep
 * their own stricter limiters on top of these.
 */
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_READ_MAX || '3000'),
  skip: (req) => req.method !== 'GET' && req.method !== 'HEAD',
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_WRITE_MAX || '300'),
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});

export const reservationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many reservations created, please try again later' },
});
