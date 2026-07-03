import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { connectionsController as C } from './connections.controller';

const router = Router();
router.use(requireAuth);

router.post('/follow/:userId', asyncHandler(C.follow));
router.delete('/follow/:userId', asyncHandler(C.unfollow));
router.post('/connect/:userId', asyncHandler(C.request));
router.post('/connect/:id/accept', asyncHandler(C.accept));
router.post('/connect/:id/reject', asyncHandler(C.reject));
router.delete('/connect/:id', asyncHandler(C.remove));
router.get('/', asyncHandler(C.list));
router.get('/pending', asyncHandler(C.pending));
router.get('/recommended', asyncHandler(C.recommended));
router.get('/suggestions/:userId', asyncHandler(C.suggestions));

export default router;
