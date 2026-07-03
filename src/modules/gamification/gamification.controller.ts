import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { gamificationService } from './gamification.service';

export const gamificationController = {
  async ranking(req: Request, res: Response) {
    const scope = req.query.scope === 'grupo' ? 'grupo' : 'geral';
    const groupId = (req.query.groupId as string) || null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const data = await gamificationService.ranking(scope, groupId, limit);
    send(res, true, data, 'ok');
  },

  async badges(_req: Request, res: Response) {
    const data = await gamificationService.listBadges();
    send(res, true, data, 'ok');
  },

  async myBadges(req: Request, res: Response) {
    const data = await gamificationService.myBadges(req.user!.id);
    send(res, true, data, 'ok');
  },
};
