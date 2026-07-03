import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { adminController } from './admin.controller';
import { updateUserSchema } from './admin.schema';

const router = Router();

// Tudo aqui exige ADMIN.
router.use(requireAuth, requireRole('ADMIN'));

router.get('/users', asyncHandler(adminController.listUsers));
router.patch('/users/:id', decodePayload, validate(updateUserSchema), asyncHandler(adminController.updateUser));
router.get('/posts/pending', asyncHandler(adminController.pendingPosts));
router.get('/metrics', asyncHandler(adminController.metrics));

export default router;
