import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { mediaService } from './media.service';
import type { CreateVideoInput, UploadImageInput } from './media.schema';

export const mediaController = {
  async uploadImage(req: Request, res: Response) {
    const data = await mediaService.uploadImage(req.user!.id, body<UploadImageInput>(req));
    send(res, true, data, 'Imagem enviada.');
  },
  async createVideo(req: Request, res: Response) {
    const data = await mediaService.createVideoUpload(req.user!.id, body<CreateVideoInput>(req));
    send(res, true, data, 'ok');
  },

  // Proxy de manifesto HLS — retorna m3u8 CRU (sem envelope), público.
  async hlsMaster(req: Request, res: Response) {
    const m3u8 = await mediaService.hlsMaster(req.params.guid!);
    res.type('application/vnd.apple.mpegurl').send(m3u8);
  },
  async hlsSub(req: Request, res: Response) {
    const m3u8 = await mediaService.hlsSub(req.params.guid!, req.params.enc!);
    res.type('application/vnd.apple.mpegurl').send(m3u8);
  },
};
