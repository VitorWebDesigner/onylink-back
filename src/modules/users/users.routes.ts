import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate, validateQuery } from '../../middlewares/validate';
import { requireAuth, optionalAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { usersController } from './users.controller';
import { pageSchema, searchSchema, updateProfileSchema } from './users.schema';

const router = Router();

router.get('/me', requireAuth, asyncHandler(usersController.me));
router.get('/me/insights', requireAuth, asyncHandler(usersController.myInsights));
router.patch('/me', requireAuth, decodePayload, validate(updateProfileSchema), asyncHandler(usersController.updateMe));
router.get('/search', optionalAuth, validateQuery(searchSchema), asyncHandler(usersController.search));
router.get('/:id/posts', optionalAuth, validateQuery(pageSchema), asyncHandler(usersController.posts));
router.get('/:id/reposts', optionalAuth, validateQuery(pageSchema), asyncHandler(usersController.reposts));
router.get('/:id/comments', optionalAuth, validateQuery(pageSchema), asyncHandler(usersController.comments));
router.get('/:id/media', optionalAuth, validateQuery(pageSchema), asyncHandler(usersController.media));
router.get('/:id/opportunities', optionalAuth, validateQuery(pageSchema), asyncHandler(usersController.opportunities));
router.get('/:id/followers', optionalAuth, validateQuery(pageSchema), asyncHandler(usersController.followers));
router.get('/:id/following', optionalAuth, validateQuery(pageSchema), asyncHandler(usersController.following));
router.get('/:id', optionalAuth, asyncHandler(usersController.byId));

export default router;
