import { Router } from 'express';
import {
  getDashboardStats, getCustomers, toggleCustomerStatus,
  updateSiteContent, getSiteContent, updateSEO, getInventory, updateInventory,
  manageBanners, createBanner, getTestimonials, getFAQs,
  getDeliveryZonesAdmin, upsertDeliveryZone, getReviewsAdmin, approveReview, deleteReview,
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { uploadBannerImage } from '../middleware/upload.middleware';
import { allowFields, requireUploadedFile } from '../middleware/validate.middleware';
import {
  adminReviewIdRules,
  createBannerRules,
  customerIdRules,
  listCustomersRules,
  listReviewsRules,
  SEO_UPDATABLE_FIELDS,
  updateInventoryRules,
  updateSEORules,
  updateSiteContentRules,
  upsertDeliveryZoneRules,
} from '../validators/admin.validator';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/customers', listCustomersRules, getCustomers);
router.put('/customers/:id/toggle-status', customerIdRules, toggleCustomerStatus);
router.get('/content', getSiteContent);
router.put('/content', updateSiteContentRules, updateSiteContent);
// allowFields guards the handler's `...seoData` spread into the upsert.
router.put('/seo', allowFields(...SEO_UPDATABLE_FIELDS), updateSEORules, updateSEO);
router.get('/inventory', getInventory);
router.put('/inventory/:productId', updateInventoryRules, updateInventory);
router.get('/banners', manageBanners);
// Validation runs after multer on multipart routes — req.body is only populated
// once the upload middleware has parsed the request.
router.post('/banners', uploadBannerImage.single('image'), requireUploadedFile, createBannerRules, createBanner);
router.get('/testimonials', getTestimonials);
router.get('/faqs', getFAQs);
router.get('/delivery-zones', getDeliveryZonesAdmin);
router.put('/delivery-zones', upsertDeliveryZoneRules, upsertDeliveryZone);
router.get('/reviews', listReviewsRules, getReviewsAdmin);
router.put('/reviews/:id/approve', adminReviewIdRules, approveReview);
router.delete('/reviews/:id', adminReviewIdRules, deleteReview);

export default router;
