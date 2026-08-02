import { Router } from 'express';
import { getDeliveryZones, getDeliveryFeeForArea, trackDelivery } from '../controllers/delivery.controller';
import { deliveryFeeRules, trackDeliveryRules } from '../validators/delivery.validator';

const router = Router();

router.get('/zones', getDeliveryZones);
router.get('/fee', deliveryFeeRules, getDeliveryFeeForArea);
router.get('/track/:reservationNumber', trackDeliveryRules, trackDelivery);

export default router;
