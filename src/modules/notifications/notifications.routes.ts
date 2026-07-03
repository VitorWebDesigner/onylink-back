import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { notificationsController } from './notifications.controller';

const router = Router();

router.get('/', requireAuth, asyncHandler(notificationsController.list));
router.get('/unread-count', requireAuth, asyncHandler(notificationsController.unreadCount));
router.post('/read-all', requireAuth, asyncHandler(notificationsController.markAllRead));
router.post('/:id/read', requireAuth, asyncHandler(notificationsController.markRead));

export default router;
