import { ContentType } from '@prisma/client';
import { body, param, query } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import { LANGUAGES, optionalSearchQuery } from './common';

// Read from the generated client so the allowlist cannot drift from the schema.
const CONTENT_TYPES = Object.values(ContentType);

/** Dotted i18n-style key: "hero.title", "home.cat_curtains_name". */
const KEY_PATTERN = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_-]+)*$/;

const localeQuery = query('locale')
  .optional({ values: 'falsy' })
  .isIn(LANGUAGES)
  .withMessage(`locale must be one of: ${LANGUAGES.join(', ')}`);

const localeBody = body('locale')
  .optional({ values: 'falsy' })
  .isIn(LANGUAGES)
  .withMessage(`locale must be one of: ${LANGUAGES.join(', ')}`);

const keyList = (field: string) =>
  body(field)
    .optional({ values: 'null' })
    .isArray({ max: 2000 })
    .withMessage(`${field} must be an array of content keys`)
    .bail()
    .custom((keys: unknown[]) => keys.every((k) => typeof k === 'string' && KEY_PATTERN.test(k)))
    .withMessage(`${field} contains an invalid content key`);

export const contentQueryRules = rules(localeQuery);

/**
 * Autosave posts every dirty block at once. The cap bounds a single request;
 * per-value shape and sanitisation happen in utils/cms so the rules stay
 * readable and the two cannot disagree.
 */
export const saveDraftsRules = rules(
  localeBody,
  body('blocks').isArray({ min: 1, max: 500 }).withMessage('blocks must be a non-empty array'),
  body('blocks.*.key')
    .isString().withMessage('Each block needs a key')
    .bail()
    .matches(KEY_PATTERN).withMessage('Content keys look like "section.name"')
    .isLength({ max: 200 }).withMessage('Content key is too long'),
  body('blocks.*.type')
    .isIn(CONTENT_TYPES)
    .withMessage(`type must be one of: ${CONTENT_TYPES.join(', ')}`),
  body('blocks.*.value').exists().withMessage('Each block needs a value'),
  body('blocks.*.page').optional({ values: 'null' }).isString().isLength({ max: 200 }),
  body('blocks.*.label').optional({ values: 'null' }).isString().isLength({ max: 200 })
);

export const publishRules = rules(
  localeBody,
  keyList('keys'),
  body('label').optional({ values: 'falsy' }).isString().isLength({ max: 200 })
);

export const discardRules = rules(localeBody, keyList('keys'));

export const revisionsRules = rules(
  param('key').matches(KEY_PATTERN).withMessage('A valid content key is required'),
  localeQuery
);

export const restoreRules = rules(
  param('key').matches(KEY_PATTERN).withMessage('A valid content key is required'),
  localeBody,
  body('revisionId').isUUID().withMessage('A valid revisionId is required')
);

export const searchRules = rules(optionalSearchQuery('q'), localeQuery);

export const replaceRules = rules(
  localeBody,
  body('find').isString().bail().isLength({ min: 1, max: 500 }).withMessage('find must be 1–500 characters'),
  body('replace').optional({ values: 'null' }).isString().isLength({ max: 500 }),
  body('dryRun').optional({ values: 'null' }).isBoolean().withMessage('dryRun must be true or false')
);

export const scheduleRules = rules(
  localeBody,
  keyList('keys'),
  body('scheduledAt')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('scheduledAt must be an ISO 8601 date')
);

export const settingsRules = rules(
  body('settings').isObject().withMessage('settings must be an object')
);
