import { Router } from 'express';
import { initiatePayment, verifyPayment, getDeliveryFees } from '../controllers/payments.controller';
import { generalLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/initiate', generalLimiter, initiatePayment);
router.get('/verify/:reference', verifyPayment);
router.get('/delivery-fees', getDeliveryFees);

export default router;
