import { Router } from 'express';
import { getBlogs, getBlogBySlug, createBlog, updateBlog, deleteBlog } from '../controllers/blog.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { uploadBlogImage } from '../middleware/upload.middleware';
import { allowFields } from '../middleware/validate.middleware';
import {
  BLOG_UPDATABLE_FIELDS,
  blogIdRules,
  blogSlugRules,
  createBlogRules,
  listBlogsRules,
  updateBlogRules,
} from '../validators/blog.validator';

const router = Router();

router.get('/', listBlogsRules, getBlogs);
router.get('/:slug', blogSlugRules, getBlogBySlug);

// Validation runs after multer on multipart routes — req.body is only populated
// once the upload middleware has parsed the request.
router.post('/', authenticate, requireAdmin, uploadBlogImage.single('image'), createBlogRules, createBlog);
// allowFields guards the handler's `data: req.body` assignment.
router.put('/:id', authenticate, requireAdmin, uploadBlogImage.single('image'), allowFields(...BLOG_UPDATABLE_FIELDS), updateBlogRules, updateBlog);
router.delete('/:id', authenticate, requireAdmin, blogIdRules, deleteBlog);

export default router;
