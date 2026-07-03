import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { optionalAuth, requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { diagnosticsController } from './diagnostics.controller';
import { createDiagnosticSchema } from './diagnostics.schema';

const router = Router();

// Porta de entrada de aquisição: aceita lead anônimo (optionalAuth).
router.post(
  '/',
  optionalAuth,
  decodePayload,
  validate(createDiagnosticSchema),
  asyncHandler(diagnosticsController.create),
);

router.get('/me/latest', requireAuth, asyncHandler(diagnosticsController.latest));

export default router;
