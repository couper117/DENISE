import { Router } from 'express';
import { getBlogs, getBlogBySlug, createBlog, updateBlog, deleteBlog } from '../controllers/blog.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { uploadBlogImage } from '../middleware/upload.middleware';

const router = Router();

router.get('/', getBlogs);
router.get('/:slug', getBlogBySlug);
router.post('/', authenticate, requireAdmin, uploadBlogImage.single('image'), createBlog);
router.put('/:id', authenticate, requireAdmin, uploadBlogImage.single('image'), updateBlog);
router.delete('/:id', authenticate, requireAdmin, deleteBlog);

export default router;
