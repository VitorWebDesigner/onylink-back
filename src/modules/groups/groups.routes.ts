import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth, optionalAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { groupsController } from './groups.controller';
import { createGroupSchema } from './groups.schema';

const router = Router();

router.get('/', optionalAuth, asyncHandler(groupsController.list));
router.get('/:slug', optionalAuth, asyncHandler(groupsController.detail));

// criação: ADMIN ou conta PROFISSIONAL (gate no service — CLAUDE.md §8)
router.post(
  '/',
  requireAuth,
  decodePayload,
  validate(createGroupSchema),
  asyncHandler(groupsController.create),
);

router.post('/:id/join', requireAuth, asyncHandler(groupsController.join));
router.post('/:id/leave', requireAuth, asyncHandler(groupsController.leave));
router.get('/:id/members', requireAuth, asyncHandler(groupsController.members));

export default router;
