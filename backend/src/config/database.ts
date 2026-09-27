import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

/**
 * On Vercel every warm function instance holds its own pool, and a free
 * Postgres plan allows only a few dozen connections in total, so each instance
 * is capped at a small pool unless the URL already says otherwise.
 */
const databaseUrl = (() => {
  const url = process.env.DATABASE_URL;
  if (!url || !process.env.VERCEL || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=3`;
})();

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
});

export const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected via Prisma');
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

export default prisma;
