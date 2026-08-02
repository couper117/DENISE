import { Router } from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { categoryIdRules, createCategoryRules, updateCategoryRules } from '../validators/category.validator';

const router = Router();

router.get('/', getCategories);
router.post('/', authenticate, requireAdmin, createCategoryRules, createCategory);
router.put('/:id', authenticate, requireAdmin, updateCategoryRules, updateCategory);
router.delete('/:id', authenticate, requireAdmin, categoryIdRules, deleteCategory);

export default router;
