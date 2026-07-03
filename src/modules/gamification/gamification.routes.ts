import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { gamificationController } from './gamification.controller';

const router = Router();

router.get('/ranking', optionalAuth, asyncHandler(gamificationController.ranking));
router.get('/badges', asyncHandler(gamificationController.badges));
router.get('/me/badges', requireAuth, asyncHandler(gamificationController.myBadges));

export default router;
