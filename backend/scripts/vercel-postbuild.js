/**
 * Runs after `npm run build` (npm "postbuild"). Only does anything on Vercel,
 * so a local build never touches a database.
 *
 * 1. Applies pending Prisma migrations to the production database.
 * 2. Break-glass admin password reset: when the project has an
 *    ADMIN_RESET_PASSWORD environment variable, the admin account's password is
 *    set to it. Remove the variable afterwards — while it exists, every deploy
 *    resets the password again. The password itself is never printed.
 */
const { execSync } = require('child_process');

if (!process.env.VERCEL) process.exit(0);

execSync('npx prisma migrate deploy', { stdio: 'inherit' });

if (process.env.ADMIN_RESET_PASSWORD) {
  require('./reset-admin-password.js')
    .run()
    .catch((err) => {
      console.error('Admin password reset failed:', err.message);
      process.exit(1);
    });
}
