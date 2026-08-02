import { body, param } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import { optionalPhoneField, PAYMENT_METHODS } from './common';

export const initiatePaymentRules = rules(
  body('reservationId').isUUID().withMessage('A valid reservationId is required'),
  body('method').isIn(PAYMENT_METHODS).withMessage(`method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  body('amount').isFloat({ gt: 0, max: 1_000_000_000 }).withMessage('amount must be a positive number'),
  body('currency').optional({ values: 'falsy' }).isIn(['RWF', 'USD', 'EUR']).withMessage('currency must be one of: RWF, USD, EUR'),
  optionalPhoneField('phoneNumber', 'Phone number')
);

export const paymentReferenceRules = rules(
  param('reference').trim().notEmpty().withMessage('Payment reference is required').isLength({ max: 100 }).withMessage('Payment reference is too long')
);
