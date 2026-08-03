import {
  DeliveryType,
  FulfillmentType,
  MeasurementOption,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '@prisma/client';
import { body, query, ValidationChain } from 'express-validator';

/**
 * Enum allowlists are read from the generated Prisma client so they cannot drift
 * from schema.prisma. Passing an unlisted value used to reach Prisma and surface
 * as a 500; these turn it into a 400 naming the field.
 */
export const RESERVATION_STATUSES = Object.values(ReservationStatus);
export const FULFILLMENT_TYPES = Object.values(FulfillmentType);
export const PAYMENT_METHODS = Object.values(PaymentMethod);
export const PAYMENT_STATUSES = Object.values(PaymentStatus);
export const DELIVERY_TYPES = Object.values(DeliveryType);
export const MEASUREMENT_OPTIONS = Object.values(MeasurementOption);

/** The five locales shipped in frontend/src/i18n/locales. */
export const LANGUAGES = ['en', 'rw', 'fr', 'sw', 'ln'];

/** Product columns that may be used as an `orderBy` key — see PRODUCT_SORT_FIELDS usage. */
export const PRODUCT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'price',
  'salePrice',
  'pricePerMeter',
  'viewCount',
  'reservationCount',
  'sortOrder',
];

/**
 * Deliberately permissive: the sign-up and reservation forms both prompt for
 * "+250 780 000 000", so separators have to be accepted. Only the digit count is
 * held to the E.164 range, and the value is stored as typed.
 */
export const isPhone = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

/**
 * Multipart bodies arrive as strings, so the controllers compare against
 * `'true'`. JSON routes send real booleans. Both are accepted.
 */
export const isBooleanish = (value: unknown): boolean =>
  typeof value === 'boolean' || value === 'true' || value === 'false';

export const PHONE_MESSAGE = 'must be a valid phone number (7–15 digits)';

export const phoneField = (field: string, label = field): ValidationChain =>
  body(field).custom(isPhone).withMessage(`${label} ${PHONE_MESSAGE}`);

export const optionalPhoneField = (field: string, label = field): ValidationChain =>
  body(field).optional({ values: 'falsy' }).custom(isPhone).withMessage(`${label} ${PHONE_MESSAGE}`);

/**
 * The forms submit an empty string for a skipped optional email, so falsy values
 * are treated as "not provided" rather than as an invalid address.
 */
export const optionalEmailField = (field: string, label = field): ValidationChain =>
  body(field)
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage(`${label} must be a valid email address`)
    .isLength({ max: 254 })
    .withMessage(`${label} is too long`);

/**
 * Minimum eight characters with a lowercase letter, an uppercase letter and a
 * digit. The upper bound matters as well: bcrypt only reads the first 72 bytes,
 * so anything beyond it is cost without benefit.
 *
 * Applied to registration and password changes only. Login checks presence
 * alone — accounts created before this policy must still be able to sign in.
 */
export const passwordField = (field: string, label = 'Password'): ValidationChain =>
  body(field)
    .isString()
    .withMessage(`${label} is required`)
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage(`${label} must be between 8 and 128 characters`)
    .bail()
    .matches(/[a-z]/)
    .withMessage(`${label} must contain a lowercase letter`)
    .matches(/[A-Z]/)
    .withMessage(`${label} must contain an uppercase letter`)
    .matches(/\d/)
    .withMessage(`${label} must contain a number`)
    .hide();

export const requiredText = (field: string, label: string, max: number): ValidationChain =>
  body(field)
    .isString()
    .withMessage(`${label} is required`)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);

export const optionalText = (field: string, label: string, max: number): ValidationChain =>
  body(field)
    .optional({ values: 'null' })
    .isString()
    .withMessage(`${label} must be text`)
    .bail()
    .trim()
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);

export const optionalLanguage = (field = 'preferredLanguage'): ValidationChain =>
  body(field)
    .optional({ values: 'falsy' })
    .isIn(LANGUAGES)
    .withMessage(`${field} must be one of: ${LANGUAGES.join(', ')}`);

export const optionalBoolean = (field: string): ValidationChain =>
  body(field)
    .optional({ values: 'null' })
    .custom(isBooleanish)
    .withMessage(`${field} must be true or false`);

/**
 * Caps `limit` so a single request cannot ask the database for an unbounded
 * result set.
 */
export const paginationRules = (): ValidationChain[] => [
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
];

export const optionalSearchQuery = (field = 'search'): ValidationChain =>
  query(field)
    .optional({ values: 'falsy' })
    .isString()
    .withMessage(`${field} must be text`)
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage(`${field} must be at most 100 characters`);
