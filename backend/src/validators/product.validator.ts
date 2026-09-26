import { body, param, query } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import {
  optionalBoolean,
  optionalSearchQuery,
  optionalText,
  paginationRules,
  PRODUCT_SORT_FIELDS,
  requiredText,
} from './common';

/**
 * `colors` arrives as a JSON string on the multipart create route (and may be a
 * real array on the JSON update route) and is fed straight to `JSON.parse`, so
 * malformed input would throw inside the handler.
 */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const isColorsPayload = (value: unknown): boolean => {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return false;
    }
  }

  return (
    Array.isArray(parsed) &&
    parsed.length <= 50 &&
    parsed.every((color) => {
      if (!color || typeof color !== 'object') return false;
      const { name, hexCode } = color as { name?: unknown; hexCode?: unknown };
      if (typeof name !== 'string' || name.trim() === '' || name.length > 60) return false;
      return hexCode === undefined || hexCode === null || hexCode === '' || (typeof hexCode === 'string' && HEX_COLOR.test(hexCode));
    })
  );
};

const COLORS_MESSAGE = 'colors must be a list of colours, each with a name (max 60 characters) and an optional #RRGGBB code';

/** Prices are optional; an empty string or null clears the price. */
const optionalPrice = (field: string, label: string) =>
  body(field).optional({ values: 'falsy' }).isFloat({ min: 0, max: 100_000_000 }).withMessage(`${label} must be a positive number`);

const productBodyRules = (required: boolean) => {
  const name = required
    ? requiredText('name', 'Product name', 200)
    : body('name').optional({ values: 'null' }).trim().notEmpty().withMessage('Product name cannot be empty').isLength({ max: 200 }).withMessage('Product name must be at most 200 characters');

  const categoryId = required
    ? body('categoryId').isUUID().withMessage('A valid categoryId is required')
    : body('categoryId').optional({ values: 'falsy' }).isUUID().withMessage('categoryId must be a valid id');

  return [
    name,
    categoryId,
    optionalText('description', 'Description', 5000),
    optionalText('specifications', 'Specifications', 5000),
    optionalText('material', 'Material', 100),
    optionalText('priceRange', 'Price range', 100),
    optionalText('promotionText', 'Promotion text', 200),
    optionalText('metaTitle', 'Meta title', 200),
    optionalText('metaDescription', 'Meta description', 500),
    optionalText('metaKeywords', 'Meta keywords', 500),
    optionalBoolean('isFeatured'),
    optionalBoolean('isNewArrival'),
    optionalBoolean('isOnPromotion'),
    optionalBoolean('isAvailable'),
    optionalPrice('price', 'Price'),
    optionalPrice('salePrice', 'Sale price'),
    optionalPrice('pricePerMeter', 'Price per metre'),
    body('colors').optional({ values: 'falsy' }).custom(isColorsPayload).withMessage(COLORS_MESSAGE),
    body('stockCount').optional({ values: 'falsy' }).isInt({ min: 0, max: 1_000_000 }).withMessage('stockCount must be a non-negative integer'),
    body('metersAvailable').optional({ values: 'falsy' }).isFloat({ min: 0, max: 1_000_000 }).withMessage('metersAvailable must be a non-negative number'),
  ];
};

export const listProductsRules = rules(
  ...paginationRules(),
  optionalSearchQuery(),
  query('category').optional({ values: 'falsy' }).isString().withMessage('category must be text').bail().trim().isLength({ max: 100 }).withMessage('category must be at most 100 characters'),
  query('material').optional({ values: 'falsy' }).isString().withMessage('material must be text').bail().trim().isLength({ max: 100 }).withMessage('material must be at most 100 characters'),
  query('availability').optional({ values: 'falsy' }).isIn(['true', 'false']).withMessage('availability must be true or false'),
  query('isFeatured').optional({ values: 'falsy' }).isIn(['true', 'false']).withMessage('isFeatured must be true or false'),
  query('isNewArrival').optional({ values: 'falsy' }).isIn(['true', 'false']).withMessage('isNewArrival must be true or false'),
  // The handler builds `orderBy: { [sortBy]: sortOrder }`. Without an allowlist
  // any string reaches Prisma as a column name and fails the query.
  query('sortBy').optional({ values: 'falsy' }).isIn(PRODUCT_SORT_FIELDS).withMessage(`sortBy must be one of: ${PRODUCT_SORT_FIELDS.join(', ')}`),
  query('sortOrder').optional({ values: 'falsy' }).isIn(['asc', 'desc']).withMessage('sortOrder must be asc or desc')
);

export const productSlugRules = rules(
  param('slug').trim().notEmpty().withMessage('Product slug is required').isLength({ max: 250 }).withMessage('Product slug is too long')
);

export const createProductRules = rules(
  ...productBodyRules(true)
);

export const updateProductRules = rules(
  param('id').isUUID().withMessage('A valid product id is required'),
  ...productBodyRules(false)
);

export const productIdRules = rules(param('id').isUUID().withMessage('A valid product id is required'));

export const productImageIdRules = rules(param('imageId').isUUID().withMessage('A valid image id is required'));

export const listAdminProductsRules = rules(
  ...paginationRules(),
  optionalSearchQuery(),
  query('category').optional({ values: 'falsy' }).isString().withMessage('category must be text').bail().trim().isLength({ max: 100 }).withMessage('category must be at most 100 characters'),
  query('status').optional({ values: 'falsy' }).isIn(['available', 'hidden', 'featured', 'new']).withMessage('status must be one of: available, hidden, featured, new')
);
