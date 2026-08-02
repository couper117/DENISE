import { body } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import {
  isPhone,
  optionalEmailField,
  optionalLanguage,
  passwordField,
  PHONE_MESSAGE,
  phoneField,
  requiredText,
} from './common';

export const registerRules = rules(
  requiredText('firstName', 'First name', 50),
  requiredText('lastName', 'Last name', 50),
  phoneField('phone', 'Phone number'),
  optionalEmailField('email', 'Email'),
  passwordField('password'),
  optionalLanguage()
);

/**
 * Login checks that an identifier is present and that the password is a
 * non-empty string — never the password *policy*, so accounts predating it can
 * still sign in.
 *
 * The identifier check is load-bearing rather than cosmetic: the controller
 * builds its lookup as `where: phone ? { phone } : { email }`, so a body with
 * neither field produces an empty `where` and `findFirst` returns whichever user
 * happens to be first in the table.
 */
export const loginRules = rules(
  body('phone').custom((value, { req }) => {
    if (!value && !req.body?.email) {
      throw new Error('Either phone or email is required');
    }
    return true;
  }),
  body('phone').optional({ values: 'falsy' }).custom(isPhone).withMessage(`Phone number ${PHONE_MESSAGE}`),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email must be a valid email address'),
  body('password').isString().withMessage('Password is required').bail().notEmpty().withMessage('Password is required').hide()
);

export const refreshTokenRules = rules(
  body('refreshToken').isString().withMessage('Refresh token is required').bail().notEmpty().withMessage('Refresh token is required').hide()
);

export const logoutRules = rules(
  body('refreshToken').optional({ values: 'falsy' }).isString().withMessage('Refresh token must be a string').hide()
);

export const updateProfileRules = rules(
  body('firstName').optional({ values: 'null' }).trim().notEmpty().withMessage('First name cannot be empty').isLength({ max: 50 }).withMessage('First name must be at most 50 characters'),
  body('lastName').optional({ values: 'null' }).trim().notEmpty().withMessage('Last name cannot be empty').isLength({ max: 50 }).withMessage('Last name must be at most 50 characters'),
  optionalEmailField('email', 'Email'),
  optionalLanguage(),
  body('darkMode').optional({ values: 'null' }).isBoolean().withMessage('darkMode must be true or false')
);

export const changePasswordRules = rules(
  body('currentPassword').isString().withMessage('Current password is required').bail().notEmpty().withMessage('Current password is required').hide(),
  passwordField('newPassword', 'New password'),
  body('newPassword').custom((value, { req }) => {
    if (value === req.body?.currentPassword) {
      throw new Error('New password must be different from the current password');
    }
    return true;
  }).hide()
);
