import { Router } from 'express';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlist.controller';
import { authenticate } from '../middleware/auth.middleware';
import { addToWishlistRules, wishlistProductIdRules } from '../validators/wishlist.validator';

const router = Router();

router.use(authenticate);
router.get('/', getWishlist);
router.post('/', addToWishlistRules, addToWishlist);
router.delete('/:productId', wishlistProductIdRules, removeFromWishlist);

export default router;
