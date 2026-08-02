import { RequestHandler } from 'express';
import { ValidationChain, validationResult } from 'express-validator';

/**
 * Terminates a validation chain: collects the errors recorded by the chains that
 * ran before it and rejects the request with 400.
 *
 * Submitted values are deliberately never echoed back — the validated fields
 * include passwords and refresh tokens, and express-validator puts the offending
 * value on every error by default.
 */
export const validate: RequestHandler = (req, res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    next();
    return;
  }

  const errors = result.array().map((err) => ({
    ...(err.type === 'field' ? { field: err.path } : {}),
    message: String(err.msg),
  }));

  res.status(400).json({ success: false, message: 'Validation failed', errors });
};

/**
 * Bundles validation chains with the terminating handler so routes can mount a
 * single value: `router.post('/', rules(body('x').notEmpty()), controller)`.
 */
export const rules = (...chains: ValidationChain[]): (ValidationChain | RequestHandler)[] => [
  ...chains,
  validate,
];

/**
 * Rejects a multipart request that carried no file.
 *
 * The handlers behind these routes index into `req.files`/`req.file` directly,
 * so an upload-less request reaches them as a TypeError and surfaces as a 500.
 */
export const requireUploadedFiles: RequestHandler = (req, res, next) => {
  const files = req.files;
  const count = Array.isArray(files) ? files.length : 0;
  if (count === 0) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'images', message: 'At least one image file is required' }],
    });
    return;
  }
  next();
};

export const requireUploadedFile: RequestHandler = (req, res, next) => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'image', message: 'An image file is required' }],
    });
    return;
  }
  next();
};

/**
 * Drops every key of `req.body` that is not in `allowed`.
 *
 * Required where a controller spreads the request body straight into a Prisma
 * `update`/`create`. Without it any caller who reaches the handler can write any
 * column on the model — view counters, slugs, timestamps, foreign keys — not
 * just the fields the endpoint is meant to expose.
 */
export const allowFields = (...allowed: string[]): RequestHandler => (req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    for (const key of Object.keys(req.body)) {
      if (!allowed.includes(key)) delete req.body[key];
    }
  }
  next();
};
