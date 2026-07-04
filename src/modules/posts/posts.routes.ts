import { Router } from 'express';
import { z } from 'zod';
import { decodePayload } from '../../middlewares/payload';
import { validate, validateQuery } from '../../middlewares/validate';
import { requireAuth, optionalAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { rateLimit } from '../../middlewares/rateLimit';
import { postsController } from './posts.controller';
import { commentSchema, createPostSchema, feedQuerySchema, updatePostSchema } from './posts.schema';

const pageSchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const router = Router();

// Feed e leitura usam query (?cursor=&limit=); escrita usa envelope payload.
router.get('/', optionalAuth, validateQuery(feedQuerySchema), asyncHandler(postsController.feed));
router.get('/saved', requireAuth, validateQuery(pageSchema), asyncHandler(postsController.listSaved));
router.get('/search', optionalAuth, asyncHandler(postsController.search));
router.get('/live', asyncHandler(postsController.live));
router.get('/latest', asyncHandler(postsController.latest));
router.get('/:id', optionalAuth, asyncHandler(postsController.getOne));
router.get('/:id/comments', optionalAuth, validateQuery(pageSchema), asyncHandler(postsController.listComments));

router.post(
  '/',
  requireAuth,
  rateLimit({ keyPrefix: 'post-create', max: 20, windowSec: 600 }),
  decodePayload,
  validate(createPostSchema),
  asyncHandler(postsController.create),
);
router.patch('/:id', requireAuth, decodePayload, validate(updatePostSchema), asyncHandler(postsController.update));
router.delete('/:id', requireAuth, asyncHandler(postsController.remove));

router.post('/:id/like', requireAuth, asyncHandler(postsController.like));
router.delete('/:id/like', requireAuth, asyncHandler(postsController.unlike));
router.post('/:id/repost', requireAuth, asyncHandler(postsController.repost));
router.delete('/:id/repost', requireAuth, asyncHandler(postsController.unrepost));
router.post('/:id/share', requireAuth, asyncHandler(postsController.share));
router.delete('/:id/share', requireAuth, asyncHandler(postsController.unshare));
router.post('/:id/insight', requireAuth, asyncHandler(postsController.insight));
router.delete('/:id/insight', requireAuth, asyncHandler(postsController.uninsight));
router.post('/:id/pin', requireAuth, asyncHandler(postsController.pin));
router.delete('/:id/pin', requireAuth, asyncHandler(postsController.unpin));
router.post('/:id/save', requireAuth, asyncHandler(postsController.save));
router.delete('/:id/save', requireAuth, asyncHandler(postsController.unsave));
router.post('/:id/view', requireAuth, asyncHandler(postsController.view));
router.post('/:id/subscribe', requireAuth, asyncHandler(postsController.subscribe));
router.delete('/:id/subscribe', requireAuth, asyncHandler(postsController.unsubscribe));

router.post(
  '/:id/comments',
  requireAuth,
  decodePayload,
  validate(commentSchema),
  asyncHandler(postsController.comment),
);
router.delete('/comments/:commentId', requireAuth, asyncHandler(postsController.removeComment));

// reações em comentário (curtir / insight)
router.post('/comments/:commentId/like', requireAuth, asyncHandler(postsController.likeComment));
router.delete('/comments/:commentId/like', requireAuth, asyncHandler(postsController.unlikeComment));
router.post('/comments/:commentId/insight', requireAuth, asyncHandler(postsController.insightComment));
router.delete('/comments/:commentId/insight', requireAuth, asyncHandler(postsController.uninsightComment));
router.post('/comments/:commentId/repost', requireAuth, asyncHandler(postsController.repostComment));
router.delete('/comments/:commentId/repost', requireAuth, asyncHandler(postsController.unrepostComment));
router.post('/comments/:commentId/share', requireAuth, asyncHandler(postsController.shareComment));
router.delete('/comments/:commentId/share', requireAuth, asyncHandler(postsController.unshareComment));

export default router;
