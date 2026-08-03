import { body, param, query } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import { optionalSearchQuery, paginationRules } from './common';

const assetId = param('id').isUUID().withMessage('A valid asset id is required');
const folderId = param('id').isUUID().withMessage('A valid folder id is required');

export const listAssetsRules = rules(
  ...paginationRules(),
  optionalSearchQuery('search'),
  query('tag').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
  // "root" is the unfiled top level; anything else must be a real folder id.
  query('folderId')
    .optional({ values: 'falsy' })
    .custom((v) => v === 'root' || /^[0-9a-f-]{36}$/i.test(String(v)))
    .withMessage('folderId must be a folder id or "root"')
);

// Multipart: multer has already run, so req.body fields are plain strings.
export const uploadAssetsRules = rules(
  body('folderId').optional({ values: 'falsy' }).isUUID().withMessage('folderId must be a valid folder id'),
  body('tags').optional({ values: 'falsy' }).isString().isLength({ max: 500 })
);

export const updateAssetRules = rules(
  assetId,
  body('filename').optional({ values: 'null' }).isString().trim().isLength({ min: 1, max: 300 })
    .withMessage('Filename must be 1–300 characters'),
  body('alt').optional({ values: 'null' }).isString().isLength({ max: 300 })
    .withMessage('Alt text must be at most 300 characters'),
  body('tags').optional({ values: 'null' }).custom((v) => Array.isArray(v) || typeof v === 'string')
    .withMessage('tags must be an array or comma-separated string'),
  body('folderId').optional({ values: 'null' }).custom((v) => v === null || /^[0-9a-f-]{36}$/i.test(String(v)))
    .withMessage('folderId must be a folder id or null')
);

export const assetIdRules = rules(assetId);

export const transformRules = rules(
  assetId,
  body('width').optional({ values: 'null' }).isInt({ min: 1, max: 8000 }),
  body('height').optional({ values: 'null' }).isInt({ min: 1, max: 8000 }),
  body('x').optional({ values: 'null' }).isInt({ min: 0, max: 20000 }),
  body('y').optional({ values: 'null' }).isInt({ min: 0, max: 20000 }),
  body('crop').optional({ values: 'falsy' }).isIn(['fill', 'crop', 'fit', 'limit', 'thumb'])
    .withMessage('crop must be one of: fill, crop, fit, limit, thumb')
);

export const createFolderRules = rules(
  body('name').isString().bail().trim().isLength({ min: 1, max: 100 })
    .withMessage('Folder name must be 1–100 characters'),
  body('parentId').optional({ values: 'falsy' }).isUUID().withMessage('parentId must be a valid folder id')
);

export const renameFolderRules = rules(
  folderId,
  body('name').isString().bail().trim().isLength({ min: 1, max: 100 })
    .withMessage('Folder name must be 1–100 characters')
);

export const folderIdRules = rules(folderId);
