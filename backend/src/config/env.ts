/**
 * Fail-fast checks for the secrets the app signs tokens with.
 *
 * `src/utils/jwt.ts` reads them with a non-null assertion, so a missing secret
 * is not caught by TypeScript and does not surface until the first request —
 * and `jwt.sign` with `undefined` throws inside a handler, which the controller
 * turns into a generic 500. A misconfigured deploy should refuse to boot rather
 * than look healthy and fail per request.
 */

const MIN_SECRET_LENGTH = 32;

/** Placeholders shipped in .env.example and the README. */
const KNOWN_PLACEHOLDERS = [
  'replace-with-64-byte-random-hex',
  'replace-with-different-64-byte-random-hex',
  'your-64-char-secret',
  'your-other-64-char-secret',
  'secret',
  'changeme',
];

const checkSecret = (name: string, value: string | undefined, problems: string[]): void => {
  if (!value) {
    problems.push(`${name} is not set`);
    return;
  }
  if (value.length < MIN_SECRET_LENGTH) {
    problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters (got ${value.length})`);
  }
  if (KNOWN_PLACEHOLDERS.includes(value.trim().toLowerCase())) {
    problems.push(`${name} is still set to a placeholder value from .env.example`);
  }
};

/**
 * Throws if the JWT secrets are missing, too short, reused between access and
 * refresh, or left at a documented placeholder.
 *
 * Reusing one secret for both is what makes it possible to present a refresh
 * token as an access token, so the two must differ.
 */
export const validateEnv = (): void => {
  const problems: string[] = [];
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  checkSecret('JWT_SECRET', accessSecret, problems);
  checkSecret('JWT_REFRESH_SECRET', refreshSecret, problems);

  if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${problems.join('\n  - ')}\n` +
        'Generate secrets with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
  }
};
