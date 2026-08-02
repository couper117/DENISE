import { body, param, query } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import { LANGUAGES, optionalSearchQuery, optionalText, paginationRules, requiredText } from './common';

/**
 * Banner links are rendered as an `href`, so only relative paths and absolute
 * http(s) URLs are accepted — this is what keeps `javascript:` and `data:` URLs
 * out of the markup.
 */
const isSafeLink = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const link = value.trim();
  return link.startsWith('/') || /^https?:\/\//i.test(link);
};

/**
 * The only body keys `updateSEO` may forward to Prisma — it spreads the rest of
 * the body into both the `update` and `create` branches of an upsert.
 */
export const SEO_UPDATABLE_FIELDS = [
  'page',
  'metaTitle',
  'metaDescription',
  'metaKeywords',
  'ogTitle',
  'ogDescription',
  'ogImage',
];

export const listCustomersRules = rules(...paginationRules(), optionalSearchQuery());

export const customerIdRules = rules(param('id').isUUID().withMessage('A valid customer id is required'));

export const updateSiteContentRules = rules(
  requiredText('key', 'Content key', 100),
  body('value').isString().withMessage('Content value is required').bail().isLength({ max: 20_000 }).withMessage('Content value is too long'),
  body('language').optional({ values: 'falsy' }).isIn(LANGUAGES).withMessage(`language must be one of: ${LANGUAGES.join(', ')}`)
);

export const updateSEORules = rules(
  requiredText('page', 'Page', 100),
  optionalText('metaTitle', 'Meta title', 200),
  optionalText('metaDescription', 'Meta description', 500),
  optionalText('metaKeywords', 'Meta keywords', 500),
  optionalText('ogTitle', 'OG title', 200),
  optionalText('ogDescription', 'OG description', 500),
  body('ogImage').optional({ values: 'falsy' }).custom(isSafeLink).withMessage('ogImage must be a relative path or an http(s) URL')
);

/**
 * `stockCount` is required rather than optional: the handler runs
 * `parseInt(stockCount)` unconditionally, so omitting it writes NaN.
 */
export const updateInventoryRules = rules(
  param('productId').isUUID().withMessage('A valid product id is required'),
  body('stockCount').isInt({ min: 0, max: 1_000_000 }).withMessage('stockCount must be a non-negative integer'),
  body('metersAvailable').optional({ values: 'falsy' }).isFloat({ min: 0, max: 1_000_000 }).withMessage('metersAvailable must be a non-negative number'),
  body('lowStockAlert').optional({ values: 'falsy' }).isInt({ min: 0, max: 1_000_000 }).withMessage('lowStockAlert must be a non-negative integer')
);

export const createBannerRules = rules(
  requiredText('title', 'Banner title', 200),
  optionalText('subtitle', 'Subtitle', 300),
  optionalText('linkText', 'Link text', 100),
  body('linkUrl').optional({ values: 'falsy' }).custom(isSafeLink).withMessage('linkUrl must be a relative path or an http(s) URL'),
  body('sortOrder').optional({ values: 'falsy' }).isInt({ min: 0, max: 100_000 }).withMessage('sortOrder must be a non-negative integer')
);

export const upsertDeliveryZoneRules = rules(
  requiredText('province', 'Province', 100),
  optionalText('district', 'District', 100),
  body('baseFee').isFloat({ min: 0, max: 10_000_000 }).withMessage('baseFee must be a non-negative number'),
  body('estimatedDays').optional({ values: 'falsy' }).isInt({ min: 0, max: 365 }).withMessage('estimatedDays must be a whole number of days'),
  body('isActive').optional({ values: 'null' }).isBoolean().withMessage('isActive must be true or false')
);

export const listReviewsRules = rules(
  ...paginationRules(),
  query('approved').optional({ values: 'falsy' }).isIn(['true', 'false']).withMessage('approved must be true or false')
);

export const adminReviewIdRules = rules(param('id').isUUID().withMessage('A valid review id is required'));
