import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { moderationController } from './moderation.controller';
import { postDecisionSchema, reportSchema, resolveReportSchema } from './moderation.schema';

const router = Router();

// Denúncia comunitária (qualquer usuário autenticado).
router.post('/report', requireAuth, decodePayload, validate(reportSchema), asyncHandler(moderationController.report));

// Painel admin.
router.get('/reports', requireAuth, requireRole('ADMIN'), asyncHandler(moderationController.listReports));
router.post(
  '/reports/:id/resolve',
  requireAuth,
  requireRole('ADMIN'),
  decodePayload,
  validate(resolveReportSchema),
  asyncHandler(moderationController.resolveReport),
);
router.post(
  '/posts/:id/decision',
  requireAuth,
  requireRole('ADMIN'),
  decodePayload,
  validate(postDecisionSchema),
  asyncHandler(moderationController.decidePost),
);

export default router;
