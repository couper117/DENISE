import { param, query } from 'express-validator';
import { rules } from '../middleware/validate.middleware';

export const deliveryFeeRules = rules(
  query('province').trim().notEmpty().withMessage('province is required').isLength({ max: 100 }).withMessage('province must be at most 100 characters'),
  query('district').optional({ values: 'falsy' }).isString().withMessage('district must be text').bail().trim().isLength({ max: 100 }).withMessage('district must be at most 100 characters')
);

export const trackDeliveryRules = rules(
  param('reservationNumber').trim().notEmpty().withMessage('Reservation number is required').isLength({ max: 50 }).withMessage('Reservation number is too long')
);
