import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { messagesController } from './messages.controller';
import { sendMessageSchema } from './messages.schema';

const router = Router();

router.get('/conversations', requireAuth, asyncHandler(messagesController.listConversations));
router.get('/conversations/:id', requireAuth, asyncHandler(messagesController.getMessages));
router.post(
  '/with/:userId',
  requireAuth,
  decodePayload,
  validate(sendMessageSchema),
  asyncHandler(messagesController.sendMessage),
);

export default router;
