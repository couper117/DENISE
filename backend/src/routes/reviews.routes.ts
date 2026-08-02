import { Router } from 'express';
import { getProductReviews, createReview, markReviewHelpful } from '../controllers/reviews.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { generalLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.get('/:productId', getProductReviews);
router.post('/', generalLimiter, optionalAuth, createReview);
router.post('/:id/helpful', generalLimiter, optionalAuth, markReviewHelpful);

export default router;
