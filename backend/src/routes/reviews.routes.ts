import { Router } from 'express';
import { getProductReviews, createReview, markReviewHelpful } from '../controllers/reviews.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { generalLimiter } from '../middleware/rateLimit.middleware';
import { createReviewRules, productReviewsRules, reviewIdRules } from '../validators/reviews.validator';

const router = Router();

router.get('/:productId', productReviewsRules, getProductReviews);
router.post('/', generalLimiter, optionalAuth, createReviewRules, createReview);
router.post('/:id/helpful', generalLimiter, optionalAuth, reviewIdRules, markReviewHelpful);

export default router;
