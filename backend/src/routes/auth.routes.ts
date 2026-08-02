import { Router } from 'express';
import { register, login, refreshToken, logout, getMe, updateProfile, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';
import {
  changePasswordRules,
  loginRules,
  logoutRules,
  refreshTokenRules,
  registerRules,
  updateProfileRules,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', authLimiter, registerRules, register);
router.post('/login', authLimiter, loginRules, login);
router.post('/refresh', refreshTokenRules, refreshToken);
router.post('/logout', authenticate, logoutRules, logout);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfileRules, updateProfile);
router.put('/change-password', authenticate, changePasswordRules, changePassword);

export default router;
