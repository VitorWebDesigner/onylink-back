import { Router } from 'express';
import { z } from 'zod';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { notificationsController } from './notifications.controller';

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(200),
  platform: z.enum(['ios', 'android']).optional(),
});

const router = Router();

router.get('/', requireAuth, asyncHandler(notificationsController.list));
router.get('/unread-count', requireAuth, asyncHandler(notificationsController.unreadCount));
router.post('/read-all', requireAuth, asyncHandler(notificationsController.markAllRead));
router.post('/push-token', requireAuth, decodePayload, validate(pushTokenSchema), asyncHandler(notificationsController.registerPushToken));
router.delete('/push-token', requireAuth, decodePayload, validate(pushTokenSchema), asyncHandler(notificationsController.unregisterPushToken));
router.post('/:id/read', requireAuth, asyncHandler(notificationsController.markRead));

export default router;
