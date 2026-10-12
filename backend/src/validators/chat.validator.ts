import { body, param, query } from 'express-validator';
import { rules } from '../middleware/validate.middleware';

const message = body('message').isString().withMessage('Message is required').bail().trim()
  .isLength({ min: 1, max: 1000 }).withMessage('Message must be 1–1000 characters');

export const startChatRules = rules(
  body('name').isString().withMessage('Name is required').bail().trim().isLength({ min: 1, max: 80 }).withMessage('Name must be 1–80 characters'),
  body('phone').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }).withMessage('Phone is too long'),
  message,
);

export const chatTokenRules = rules(
  param('token').isString().isLength({ min: 32, max: 64 }).matches(/^[a-f0-9]+$/).withMessage('Invalid chat'),
  query('after').optional().isISO8601().withMessage('after must be a date'),
);

export const customerMessageRules = rules(
  param('token').isString().isLength({ min: 32, max: 64 }).matches(/^[a-f0-9]+$/).withMessage('Invalid chat'),
  message,
);

export const adminChatIdRules = rules(param('id').isUUID().withMessage('Invalid chat id'));
export const adminReplyRules = rules(param('id').isUUID().withMessage('Invalid chat id'), message);
export const adminChatStatusRules = rules(
  param('id').isUUID().withMessage('Invalid chat id'),
  body('status').isIn(['OPEN', 'CLOSED']).withMessage('status must be OPEN or CLOSED'),
);
export const adminAlertsRules = rules(query('since').optional().isISO8601().withMessage('since must be a date'));
