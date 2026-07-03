import { Router } from 'express';
import { decodePayload } from '../../middlewares/payload';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { rateLimit } from '../../middlewares/rateLimit';
import { mediaController } from './media.controller';
import { createVideoSchema, uploadImageSchema } from './media.schema';

const router = Router();

router.post(
  '/image',
  requireAuth,
  rateLimit({ keyPrefix: 'media-upload', max: 40, windowSec: 600 }),
  decodePayload,
  validate(uploadImageSchema),
  asyncHandler(mediaController.uploadImage),
);

router.post(
  '/video/create',
  requireAuth,
  rateLimit({ keyPrefix: 'media-video', max: 20, windowSec: 600 }),
  decodePayload,
  validate(createVideoSchema),
  asyncHandler(mediaController.createVideo),
);

// Proxy de manifesto HLS (público; o token de diretório nas URLs de segmento é a segurança).
router.get('/hls/:guid/master.m3u8', asyncHandler(mediaController.hlsMaster));
router.get('/hls/:guid/sub/:enc', asyncHandler(mediaController.hlsSub));

export default router;
