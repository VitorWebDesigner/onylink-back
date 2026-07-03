import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { groupsService } from './groups.service';
import { listGroupsSchema, type CreateGroupInput } from './groups.schema';

export const groupsController = {
  async list(req: Request, res: Response) {
    const input = listGroupsSchema.parse(req.query);
    const data = await groupsService.list(input);
    send(res, true, data, 'ok');
  },

  async detail(req: Request, res: Response) {
    const data = await groupsService.bySlug(req.params.slug!);
    send(res, true, data, 'ok');
  },

  async create(req: Request, res: Response) {
    const data = await groupsService.create(body<CreateGroupInput>(req), req.user!.id);
    send(res, true, data, 'Grupo criado!');
  },

  async join(req: Request, res: Response) {
    const data = await groupsService.join(req.params.id!, req.user!.id);
    send(res, true, data, 'Você entrou no grupo.');
  },

  async leave(req: Request, res: Response) {
    const data = await groupsService.leave(req.params.id!, req.user!.id);
    send(res, true, data, 'Você saiu do grupo.');
  },

  async members(req: Request, res: Response) {
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const data = await groupsService.members(req.params.id!, limit, offset);
    send(res, true, data, 'ok');
  },
};
