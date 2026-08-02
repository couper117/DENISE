import { Router } from 'express';
import {
  createReservation, getReservationByNumber, getMyReservations, getAllReservations,
  updateReservationStatus, cancelReservation, getReservationStats,
} from '../controllers/reservation.controller';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { reservationLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/', reservationLimiter, optionalAuth, createReservation);
router.get('/track/:number', getReservationByNumber);
router.get('/my', authenticate, getMyReservations);
router.get('/stats', authenticate, requireAdmin, getReservationStats);
router.get('/', authenticate, requireAdmin, getAllReservations);
router.put('/:id/status', authenticate, requireAdmin, updateReservationStatus);
router.put('/:id/cancel', optionalAuth, cancelReservation);

export default router;
