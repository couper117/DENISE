import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { startConversation, getConversation, postCustomerMessage } from '../controllers/chat.controller';
import { startChatRules, chatTokenRules, customerMessageRules } from '../validators/chat.validator';

const router = Router();

// Per-IP ceiling on chat writes so the inbox cannot be flooded.
const chatWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { success: false, message: 'Too many messages, please wait a few minutes' },
});

router.post('/', chatWriteLimiter, startChatRules, startConversation);
router.get('/:token', chatTokenRules, getConversation);
router.post('/:token/messages', chatWriteLimiter, customerMessageRules, postCustomerMessage);

export default router;
