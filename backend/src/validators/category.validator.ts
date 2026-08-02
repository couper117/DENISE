import { body, param } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import { optionalText, requiredText } from './common';

export const createCategoryRules = rules(
  requiredText('name', 'Category name', 100),
  optionalText('description', 'Description', 1000),
  body('parentId').optional({ values: 'falsy' }).isUUID().withMessage('parentId must be a valid category id'),
  body('sortOrder').optional({ values: 'falsy' }).isInt({ min: 0, max: 100_000 }).withMessage('sortOrder must be a non-negative integer')
);

export const updateCategoryRules = rules(
  param('id').isUUID().withMessage('A valid category id is required'),
  body('name').optional({ values: 'null' }).trim().notEmpty().withMessage('Category name cannot be empty').isLength({ max: 100 }).withMessage('Category name must be at most 100 characters'),
  optionalText('description', 'Description', 1000),
  body('isActive').optional({ values: 'null' }).isBoolean().withMessage('isActive must be true or false'),
  body('sortOrder').optional({ values: 'falsy' }).isInt({ min: 0, max: 100_000 }).withMessage('sortOrder must be a non-negative integer')
);

export const categoryIdRules = rules(param('id').isUUID().withMessage('A valid category id is required'));
