import { Router } from 'express';
import { initiatePayment, verifyPayment, getDeliveryFees } from '../controllers/payments.controller';
import { generalLimiter } from '../middleware/rateLimit.middleware';
import { optionalAuth } from '../middleware/auth.middleware';
import { initiatePaymentRules, paymentReferenceRules } from '../validators/payments.validator';

const router = Router();

router.post('/initiate', generalLimiter, optionalAuth, initiatePaymentRules, initiatePayment);
router.get('/verify/:reference', paymentReferenceRules, verifyPayment);
router.get('/delivery-fees', getDeliveryFees);

export default router;
