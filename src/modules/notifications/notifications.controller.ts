import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { notificationsService } from './notifications.service';

export const notificationsController = {
  async list(req: Request, res: Response) {
    const data = await notificationsService.list(
      req.user!.id,
      Number(req.query.limit ?? 30),
      Number(req.query.offset ?? 0),
    );
    send(res, true, data, 'ok');
  },

  async unreadCount(req: Request, res: Response) {
    const data = await notificationsService.unreadCount(req.user!.id);
    send(res, true, data, 'ok');
  },

  async markRead(req: Request, res: Response) {
    const data = await notificationsService.markRead(req.user!.id, req.params.id!);
    send(res, true, data, 'ok');
  },

  async markAllRead(req: Request, res: Response) {
    const data = await notificationsService.markAllRead(req.user!.id);
    send(res, true, data, 'ok');
  },

  async registerPushToken(req: Request, res: Response) {
    const { token, platform } = body<{ token: string; platform?: string }>(req);
    send(res, true, await notificationsService.registerPushToken(req.user!.id, token, platform), 'ok');
  },

  async unregisterPushToken(req: Request, res: Response) {
    const { token } = body<{ token: string }>(req);
    send(res, true, await notificationsService.unregisterPushToken(req.user!.id, token), 'ok');
  },
};
