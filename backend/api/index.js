/**
 * Vercel entry. The build (`npm run build`) compiles src/ to dist/ and applies
 * migrations; every request is rewritten here (vercel.json) and handled by the
 * same Express app that `npm start` runs locally. Loading the compiled JS lets
 * Vercel trace every dependency into the function bundle.
 */
module.exports = require('../dist/app').default;
