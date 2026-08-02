import { Router } from 'express';
import { getDeliveryZones, getDeliveryFeeForArea, trackDelivery } from '../controllers/delivery.controller';

const router = Router();

router.get('/zones', getDeliveryZones);
router.get('/fee', getDeliveryFeeForArea);
router.get('/track/:reservationNumber', trackDelivery);

export default router;
