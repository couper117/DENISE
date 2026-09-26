import { Router } from 'express';
import {
  getProducts, getProductBySlug, getFeaturedProducts, getNewArrivals,
  createProduct, updateProduct, deleteProduct, addProductImages, deleteProductImage, setPrimaryProductImage,
} from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { uploadProductImages, withUploadErrors } from '../middleware/upload.middleware';
import { requireUploadedFiles } from '../middleware/validate.middleware';
import {
  createProductRules,
  listProductsRules,
  productIdRules,
  productImageIdRules,
  productSlugRules,
  updateProductRules,
} from '../validators/product.validator';

const router = Router();

router.get('/', listProductsRules, getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/new-arrivals', getNewArrivals);
router.get('/:slug', productSlugRules, getProductBySlug);

// Validation runs after multer on multipart routes — req.body is only populated
// once the upload middleware has parsed the request.
router.post('/', authenticate, requireAdmin, withUploadErrors(uploadProductImages.array('images', 10)), createProductRules, createProduct);
router.put('/:id', authenticate, requireAdmin, updateProductRules, updateProduct);
router.delete('/:id', authenticate, requireAdmin, productIdRules, deleteProduct);
router.post('/:id/images', authenticate, requireAdmin, withUploadErrors(uploadProductImages.array('images', 10)), productIdRules, requireUploadedFiles, addProductImages);
router.put('/images/:imageId/primary', authenticate, requireAdmin, productImageIdRules, setPrimaryProductImage);
router.delete('/images/:imageId', authenticate, requireAdmin, productImageIdRules, deleteProductImage);

export default router;
