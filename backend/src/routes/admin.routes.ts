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

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/customers', getCustomers);
router.put('/customers/:id/toggle-status', toggleCustomerStatus);
router.get('/content', getSiteContent);
router.put('/content', updateSiteContent);
router.put('/seo', updateSEO);
router.get('/inventory', getInventory);
router.put('/inventory/:productId', updateInventory);
router.get('/banners', manageBanners);
router.post('/banners', uploadBannerImage.single('image'), createBanner);
router.get('/testimonials', getTestimonials);
router.get('/faqs', getFAQs);
router.get('/delivery-zones', getDeliveryZonesAdmin);
router.put('/delivery-zones', upsertDeliveryZone);
router.get('/reviews', getReviewsAdmin);
router.put('/reviews/:id/approve', approveReview);
router.delete('/reviews/:id', deleteReview);

export default router;
