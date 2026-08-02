import { Router } from 'express';
import {
  getProducts, getProductBySlug, getFeaturedProducts, getNewArrivals,
  createProduct, updateProduct, deleteProduct, addProductImages, deleteProductImage,
} from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { uploadProductImages } from '../middleware/upload.middleware';

const router = Router();

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/new-arrivals', getNewArrivals);
router.get('/:slug', getProductBySlug);

router.post('/', authenticate, requireAdmin, uploadProductImages.array('images', 10), createProduct);
router.put('/:id', authenticate, requireAdmin, updateProduct);
router.delete('/:id', authenticate, requireAdmin, deleteProduct);
router.post('/:id/images', authenticate, requireAdmin, uploadProductImages.array('images', 10), addProductImages);
router.delete('/images/:imageId', authenticate, requireAdmin, deleteProductImage);

export default router;
