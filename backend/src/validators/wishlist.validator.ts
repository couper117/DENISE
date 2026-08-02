import { body, param } from 'express-validator';
import { rules } from '../middleware/validate.middleware';

export const addToWishlistRules = rules(
  body('productId').isUUID().withMessage('A valid productId is required')
);

export const wishlistProductIdRules = rules(
  param('productId').isUUID().withMessage('A valid product id is required')
);
