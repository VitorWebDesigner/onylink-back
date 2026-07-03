import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { optionalAuth, requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { opportunitiesController } from './opportunities.controller';
import { applyOpportunitySchema, createOpportunitySchema, opportunityCommentSchema, updateApplicationSchema } from './opportunities.schema';

const router = Router();

router.post('/', requireAuth, decodePayload, validate(createOpportunitySchema), asyncHandler(opportunitiesController.create));
router.get('/', optionalAuth, asyncHandler(opportunitiesController.list));
// /mine ANTES de /:id (senão "mine" cai no parâmetro :id).
router.get('/mine', requireAuth, asyncHandler(opportunitiesController.mine));
// PATCH de candidatura — caminho estático antes do :id paramétrico.
router.patch('/applications/:appId', requireAuth, decodePayload, validate(updateApplicationSchema), asyncHandler(opportunitiesController.updateApplication));

router.get('/:id', optionalAuth, asyncHandler(opportunitiesController.byId));
router.delete('/:id', requireAuth, asyncHandler(opportunitiesController.remove));

// curtidas
router.post('/:id/like', requireAuth, asyncHandler(opportunitiesController.like));
router.delete('/:id/like', requireAuth, asyncHandler(opportunitiesController.unlike));
router.post('/:id/insight', requireAuth, asyncHandler(opportunitiesController.insight));
router.delete('/:id/insight', requireAuth, asyncHandler(opportunitiesController.uninsight));
router.post('/:id/view', requireAuth, asyncHandler(opportunitiesController.view));
router.post('/:id/subscribe', requireAuth, asyncHandler(opportunitiesController.subscribe));
router.delete('/:id/subscribe', requireAuth, asyncHandler(opportunitiesController.unsubscribe));

// comentários
router.get('/:id/comments', optionalAuth, asyncHandler(opportunitiesController.listComments));
router.post('/:id/comments', requireAuth, decodePayload, validate(opportunityCommentSchema), asyncHandler(opportunitiesController.addComment));
// reações em comentário de oportunidade
router.post('/comments/:commentId/like', requireAuth, asyncHandler(opportunitiesController.likeComment));
router.delete('/comments/:commentId/like', requireAuth, asyncHandler(opportunitiesController.unlikeComment));
router.post('/comments/:commentId/insight', requireAuth, asyncHandler(opportunitiesController.insightComment));
router.delete('/comments/:commentId/insight', requireAuth, asyncHandler(opportunitiesController.uninsightComment));
router.post('/comments/:commentId/repost', requireAuth, asyncHandler(opportunitiesController.repostComment));
router.delete('/comments/:commentId/repost', requireAuth, asyncHandler(opportunitiesController.unrepostComment));
router.post('/comments/:commentId/share', requireAuth, asyncHandler(opportunitiesController.shareComment));
router.delete('/comments/:commentId/share', requireAuth, asyncHandler(opportunitiesController.unshareComment));

// candidaturas
router.post('/:id/apply', requireAuth, decodePayload, validate(applyOpportunitySchema), asyncHandler(opportunitiesController.apply));
router.get('/:id/applications', requireAuth, asyncHandler(opportunitiesController.applications));

export default router;
