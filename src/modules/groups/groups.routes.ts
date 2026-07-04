import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth, optionalAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { groupsController } from './groups.controller';
import { createGroupSchema, updateGroupSchema } from './groups.schema';

const router = Router();

router.get('/', optionalAuth, asyncHandler(groupsController.list));

// criação: ADMIN ou conta PROFISSIONAL (gate no service — CLAUDE.md §8)
router.post('/', requireAuth, decodePayload, validate(createGroupSchema), asyncHandler(groupsController.create));

router.post('/:id/join', requireAuth, asyncHandler(groupsController.join));
router.post('/:id/leave', requireAuth, asyncHandler(groupsController.leave));
router.get('/:id/members', requireAuth, asyncHandler(groupsController.members));
router.delete('/:id/members/:userId', requireAuth, asyncHandler(groupsController.removeMember));

// pedidos de entrada (comunidade privada — só admin)
router.get('/:id/requests', requireAuth, asyncHandler(groupsController.listRequests));
router.post('/:id/requests/:userId/approve', requireAuth, asyncHandler(groupsController.approveRequest));
router.post('/:id/requests/:userId/reject', requireAuth, asyncHandler(groupsController.rejectRequest));

// repost pro feed geral (admin escolhe posts da comunidade)
router.post('/:id/feature/:postId', requireAuth, asyncHandler(groupsController.feature));
router.delete('/:id/feature/:postId', requireAuth, asyncHandler(groupsController.unfeature));

// fixar comunidade (máx. 5)
router.post('/:id/pin', requireAuth, asyncHandler(groupsController.pin));
router.delete('/:id/pin', requireAuth, asyncHandler(groupsController.unpin));

// edição (admin)
router.patch('/:id', requireAuth, decodePayload, validate(updateGroupSchema), asyncHandler(groupsController.update));

// detalhe por id OU slug — por último (rota coringa de 1 segmento)
router.get('/:slug', optionalAuth, asyncHandler(groupsController.detail));

export default router;
