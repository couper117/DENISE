import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

/**
 * On Vercel every warm function instance holds its own pool, and a free
 * Postgres plan allows only a few dozen connections in total, so each instance
 * is capped at a single connection unless the URL already says otherwise. A
 * warm instance keeps its connection until Vercel retires it, so a burst that
 * starts N instances holds N connections for a while afterwards: 1 each keeps
 * that within the 20 the free Aiven plan allows. With the functions next to
 * the database (bom1) a query takes milliseconds, so one is enough.
 */
const databaseUrl = (() => {
  const url = process.env.DATABASE_URL;
  if (!url || !process.env.VERCEL || /[?&]connection_limit=/.test(url)) return url;
  // pool_timeout: under a burst, wait for a free connection a little longer
  // rather than failing the request after Prisma's default 10 s.
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1&pool_timeout=20`;
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
