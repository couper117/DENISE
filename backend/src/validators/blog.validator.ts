import { body, param } from 'express-validator';
import { rules } from '../middleware/validate.middleware';
import { optionalBoolean, optionalSearchQuery, optionalText, paginationRules, requiredText } from './common';

/**
 * The only body keys `updateBlog` may forward to Prisma. It assigns `req.body`
 * to `data` wholesale, so without this list a caller could rewrite `slug`,
 * `viewCount`, `publishedAt` or `createdAt` on any post.
 *
 * `slug`, `publishedAt`, `imageUrl` and `imagePublicId` are intentionally absent:
 * the handler derives them itself after this middleware has run.
 */
export const BLOG_UPDATABLE_FIELDS = [
  'title',
  'content',
  'excerpt',
  'authorName',
  'isPublished',
  'metaTitle',
  'metaDescription',
  'metaKeywords',
];

export const listBlogsRules = rules(...paginationRules(), optionalSearchQuery());

export const blogSlugRules = rules(
  param('slug').trim().notEmpty().withMessage('Blog slug is required').isLength({ max: 250 }).withMessage('Blog slug is too long')
);

export const createBlogRules = rules(
  requiredText('title', 'Title', 200),
  requiredText('content', 'Content', 50_000),
  requiredText('authorName', 'Author name', 100),
  optionalText('excerpt', 'Excerpt', 500),
  optionalBoolean('isPublished'),
  optionalText('metaTitle', 'Meta title', 200),
  optionalText('metaDescription', 'Meta description', 500),
  optionalText('metaKeywords', 'Meta keywords', 500)
);

export const updateBlogRules = rules(
  param('id').isUUID().withMessage('A valid blog id is required'),
  body('title').optional({ values: 'null' }).trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),
  body('content').optional({ values: 'null' }).trim().notEmpty().withMessage('Content cannot be empty').isLength({ max: 50_000 }).withMessage('Content is too long'),
  body('authorName').optional({ values: 'null' }).trim().notEmpty().withMessage('Author name cannot be empty').isLength({ max: 100 }).withMessage('Author name must be at most 100 characters'),
  optionalText('excerpt', 'Excerpt', 500),
  optionalBoolean('isPublished'),
  optionalText('metaTitle', 'Meta title', 200),
  optionalText('metaDescription', 'Meta description', 500),
  optionalText('metaKeywords', 'Meta keywords', 500)
);

export const blogIdRules = rules(param('id').isUUID().withMessage('A valid blog id is required'));
