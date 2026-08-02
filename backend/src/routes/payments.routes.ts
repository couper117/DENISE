import { Router } from 'express';
import { initiatePayment, verifyPayment, getDeliveryFees } from '../controllers/payments.controller';
import { generalLimiter } from '../middleware/rateLimit.middleware';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/initiate', generalLimiter, optionalAuth, initiatePayment);
router.get('/verify/:reference', verifyPayment);
router.get('/delivery-fees', getDeliveryFees);

export default router;
