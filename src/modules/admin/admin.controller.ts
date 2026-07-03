import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { adminService } from './admin.service';
import type { UpdateUserInput } from './admin.schema';

export const adminController = {
  async listUsers(req: Request, res: Response) {
    const search = (req.query.q as string) || null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const data = await adminService.listUsers(search, limit, offset);
    send(res, true, data, 'ok');
  },

  async updateUser(req: Request, res: Response) {
    const data = await adminService.updateUser(req.params.id!, body<UpdateUserInput>(req));
    send(res, true, data, 'Usuário atualizado.');
  },

  async pendingPosts(req: Request, res: Response) {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const data = await adminService.pendingPosts(limit, offset);
    send(res, true, data, 'ok');
  },

  async metrics(_req: Request, res: Response) {
    const data = await adminService.metrics();
    send(res, true, data, 'ok');
  },
};
