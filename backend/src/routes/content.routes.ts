import { Router } from 'express';
import { getTestimonials, getFAQs } from '../controllers/admin.controller';

// Public, read-only content shown on the marketing site (home, etc.).
// The handlers already return only approved testimonials / active FAQs.
const router = Router();

router.get('/testimonials', getTestimonials);
router.get('/faqs', getFAQs);

export default router;
