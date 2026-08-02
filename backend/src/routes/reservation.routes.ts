import { Router } from 'express';
import {
  createReservation, getReservationByNumber, getMyReservations, getAllReservations,
  updateReservationStatus, cancelReservation, getReservationStats,
} from '../controllers/reservation.controller';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { reservationLimiter } from '../middleware/rateLimit.middleware';
import {
  cancelReservationRules,
  createReservationRules,
  listReservationsRules,
  trackReservationRules,
  updateReservationStatusRules,
} from '../validators/reservation.validator';

const router = Router();

router.post('/', reservationLimiter, optionalAuth, createReservationRules, createReservation);
router.get('/track/:number', trackReservationRules, getReservationByNumber);
router.get('/my', authenticate, getMyReservations);
router.get('/stats', authenticate, requireAdmin, getReservationStats);
router.get('/', authenticate, requireAdmin, listReservationsRules, getAllReservations);
router.put('/:id/status', authenticate, requireAdmin, updateReservationStatusRules, updateReservationStatus);
router.put('/:id/cancel', optionalAuth, cancelReservationRules, cancelReservation);

export default router;
