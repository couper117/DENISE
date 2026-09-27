import 'dotenv/config';
import app from './app';
import { connectDB } from './config/database';
import { validateEnv } from './config/env';
import { publishScheduled } from './controllers/cms.controller';
import logger from './utils/logger';

/**
 * Long-running server entry (local development, or any host that runs
 * `npm start`). Vercel does not use this file: it serves `api/index.ts`,
 * which exports the same app as a function.
 */
const PORT = process.env.PORT || 5000;

const start = async () => {
  // Before the socket opens, so a misconfigured deploy fails its health check
  // instead of accepting traffic it cannot serve.
  validateEnv();

  app.listen(PORT, () => {
    logger.info(`DENISE Textile API running on port ${PORT}`);
  });

  // Release scheduled CMS publishes. Each release clears scheduledAt, so a
  // second instance would find nothing to do rather than double-publishing.
  setInterval(() => {
    publishScheduled().catch((e) => logger.error('Scheduled publish failed:', e));
  }, 60_000).unref();

  connectDB().catch((err) => {
    logger.warn('Database unavailable — API running without DB:', err.message);
  });
};

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
