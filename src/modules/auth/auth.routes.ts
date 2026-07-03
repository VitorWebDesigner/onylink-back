import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { rateLimit } from '../../middlewares/rateLimit';
import { asyncHandler } from '../../middlewares/error';
import { authController } from './auth.controller';
import { forgotSchema, loginSchema, newPassSchema, refreshSchema, registerSchema } from './auth.schema';

const router = Router();

// Todas as rotas decodificam o envelope payload-in-JWT primeiro (decodePayload).
router.post('/register', decodePayload, validate(registerSchema), asyncHandler(authController.register));

router.post(
  '/login',
  rateLimit({ keyPrefix: 'login', max: 10, windowSec: 300 }),
  decodePayload,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post(
  '/forgot_pass',
  rateLimit({ keyPrefix: 'forgot', max: 5, windowSec: 600 }),
  decodePayload,
  validate(forgotSchema),
  asyncHandler(authController.forgot),
);

router.post('/new_pass', decodePayload, validate(newPassSchema), asyncHandler(authController.newPass));
router.post('/refresh', decodePayload, validate(refreshSchema), asyncHandler(authController.refresh));
router.post('/logout', decodePayload, asyncHandler(authController.logout));
router.get('/me', requireAuth, asyncHandler(authController.me));
router.get('/handle-available', asyncHandler(authController.handleAvailable));

export default router;
