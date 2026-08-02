import { body, param, query } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import {
  DELIVERY_TYPES,
  FULFILLMENT_TYPES,
  MEASUREMENT_OPTIONS,
  optionalLanguage,
  optionalPhoneField,
  optionalSearchQuery,
  optionalText,
  paginationRules,
  PAYMENT_METHODS,
  phoneField,
  requiredText,
  RESERVATION_STATUSES,
} from './common';

const optionalItemNumber = (field: string, label: string, max: number) =>
  body(`items.*.${field}`)
    .optional({ values: 'null' })
    .isFloat({ min: 0, max })
    .withMessage(`${label} must be a positive number`);

export const createReservationRules = rules(
  requiredText('customerName', 'Customer name', 100),
  phoneField('customerPhone', 'Customer phone'),
  body('customerEmail').optional({ values: 'falsy' }).isEmail().withMessage('Customer email must be a valid email address'),
  optionalLanguage(),
  body('fulfillmentType').optional({ values: 'falsy' }).isIn(FULFILLMENT_TYPES).withMessage(`fulfillmentType must be one of: ${FULFILLMENT_TYPES.join(', ')}`),
  body('visitDate').optional({ values: 'falsy' }).isISO8601().withMessage('visitDate must be a valid date'),
  optionalText('visitTime', 'Visit time', 20),
  optionalText('notes', 'Notes', 1000),
  body('measurementOption').optional({ values: 'falsy' }).isIn(MEASUREMENT_OPTIONS).withMessage(`measurementOption must be one of: ${MEASUREMENT_OPTIONS.join(', ')}`),
  body('paymentMethod').optional({ values: 'falsy' }).isIn(PAYMENT_METHODS).withMessage(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`),
  optionalPhoneField('mobileMoneyPhone', 'Mobile money phone'),
  body('deliveryType').optional({ values: 'falsy' }).isIn(DELIVERY_TYPES).withMessage(`deliveryType must be one of: ${DELIVERY_TYPES.join(', ')}`),
  body('scheduledDeliveryDate').optional({ values: 'falsy' }).isISO8601().withMessage('scheduledDeliveryDate must be a valid date'),

  // Bounded so a single request cannot ask the handler to create an unlimited
  // number of reservation items.
  body('items').optional({ values: 'null' }).isArray({ max: 50 }).withMessage('items must be an array of at most 50 entries'),
  body('items.*.productId').isUUID().withMessage('Each item requires a valid productId'),
  body('items.*.quantity').optional({ values: 'null' }).isInt({ min: 1, max: 10_000 }).withMessage('Item quantity must be a positive whole number'),
  optionalItemNumber('metersRequired', 'Meters required', 100_000),
  optionalItemNumber('windowWidth', 'Window width', 100_000),
  optionalItemNumber('windowHeight', 'Window height', 100_000),
  optionalItemNumber('unitPrice', 'Unit price', 1_000_000_000),
  optionalItemNumber('totalPrice', 'Total price', 1_000_000_000),
  optionalText('items.*.notes', 'Item notes', 500),

  // A delivery order without a province and district is accepted by the handler
  // and stored with no address at all, so the pair is required for that mode.
  body('deliveryAddress.province')
    .if(body('fulfillmentType').equals('DELIVERY'))
    .trim()
    .notEmpty()
    .withMessage('Province is required for delivery orders')
    .isLength({ max: 100 })
    .withMessage('Province must be at most 100 characters'),
  body('deliveryAddress.district')
    .if(body('fulfillmentType').equals('DELIVERY'))
    .trim()
    .notEmpty()
    .withMessage('District is required for delivery orders')
    .isLength({ max: 100 })
    .withMessage('District must be at most 100 characters'),
  optionalText('deliveryAddress.sector', 'Sector', 100),
  optionalText('deliveryAddress.cell', 'Cell', 100),
  optionalText('deliveryAddress.village', 'Village', 100),
  optionalText('deliveryAddress.streetAddress', 'Street address', 200)
);

export const trackReservationRules = rules(
  param('number').trim().notEmpty().withMessage('Reservation number is required').isLength({ max: 50 }).withMessage('Reservation number is too long')
);

export const listReservationsRules = rules(
  ...paginationRules(),
  optionalSearchQuery(),
  query('status').optional({ values: 'falsy' }).isIn(RESERVATION_STATUSES).withMessage(`status must be one of: ${RESERVATION_STATUSES.join(', ')}`),
  query('fulfillmentType').optional({ values: 'falsy' }).isIn(FULFILLMENT_TYPES).withMessage(`fulfillmentType must be one of: ${FULFILLMENT_TYPES.join(', ')}`),
  query('date').optional({ values: 'falsy' }).isISO8601().withMessage('date must be a valid date')
);

export const updateReservationStatusRules = rules(
  param('id').isUUID().withMessage('A valid reservation id is required'),
  body('status').isIn(RESERVATION_STATUSES).withMessage(`status must be one of: ${RESERVATION_STATUSES.join(', ')}`),
  optionalText('adminNotes', 'Admin notes', 1000),
  optionalText('cancelReason', 'Cancel reason', 500)
);

export const cancelReservationRules = rules(
  param('id').isUUID().withMessage('A valid reservation id is required'),
  optionalText('cancelReason', 'Cancel reason', 500),
  // Proves ownership of a guest reservation; the handler decides when it is required.
  optionalPhoneField('customerPhone', 'Customer phone')
);
