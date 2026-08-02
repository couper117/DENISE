import { body, param } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import { optionalText, requiredText } from './common';

export const productReviewsRules = rules(
  param('productId').isUUID().withMessage('A valid product id is required')
);

export const createReviewRules = rules(
  body('productId').isUUID().withMessage('A valid productId is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be a whole number between 1 and 5'),
  requiredText('message', 'Review message', 2000),
  optionalText('title', 'Review title', 200),
  optionalText('customerName', 'Customer name', 100)
);

export const reviewIdRules = rules(param('id').isUUID().withMessage('A valid review id is required'));
