import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { groupsService } from './groups.service';
import { listGroupsSchema, type CreateGroupInput, type UpdateGroupInput } from './groups.schema';

export const groupsController = {
  async list(req: Request, res: Response) {
    const input = listGroupsSchema.parse(req.query);
    send(res, true, await groupsService.list(input, req.user?.id), 'ok');
  },

  async detail(req: Request, res: Response) {
    send(res, true, await groupsService.detail(req.params.slug!, req.user?.id), 'ok');
  },

  async create(req: Request, res: Response) {
    send(res, true, await groupsService.create(body<CreateGroupInput>(req), req.user!.id), 'Comunidade criada!');
  },

  async update(req: Request, res: Response) {
    send(res, true, await groupsService.update(req.params.id!, req.user!.id, body<UpdateGroupInput>(req)), 'Comunidade atualizada!');
  },

  async join(req: Request, res: Response) {
    const data = await groupsService.join(req.params.id!, req.user!.id);
    send(res, true, data, data.requested ? 'Pedido enviado — aguarde a aprovação do admin.' : 'Você entrou na comunidade.');
  },

  async leave(req: Request, res: Response) {
    send(res, true, await groupsService.leave(req.params.id!, req.user!.id), 'Você saiu da comunidade.');
  },

  async members(req: Request, res: Response) {
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    send(res, true, await groupsService.members(req.params.id!, req.user!.id, limit, offset), 'ok');
  },

  async removeMember(req: Request, res: Response) {
    send(res, true, await groupsService.removeMember(req.params.id!, req.user!.id, req.params.userId!), 'Membro removido.');
  },

  async promote(req: Request, res: Response) {
    send(res, true, await groupsService.promote(req.params.id!, req.user!.id, req.params.userId!), 'Agora é admin da comunidade.');
  },

  async transfer(req: Request, res: Response) {
    send(res, true, await groupsService.transferOwnership(req.params.id!, req.user!.id, req.params.userId!), 'Propriedade transferida.');
  },

  async listRequests(req: Request, res: Response) {
    send(res, true, await groupsService.listRequests(req.params.id!, req.user!.id), 'ok');
  },

  async approveRequest(req: Request, res: Response) {
    send(res, true, await groupsService.approveRequest(req.params.id!, req.user!.id, req.params.userId!), 'Pedido aprovado.');
  },

  async rejectRequest(req: Request, res: Response) {
    send(res, true, await groupsService.rejectRequest(req.params.id!, req.user!.id, req.params.userId!), 'Pedido recusado.');
  },

  async feature(req: Request, res: Response) {
    send(res, true, await groupsService.featurePost(req.params.id!, req.user!.id, req.params.postId!, true), 'Post repostado no feed.');
  },

  async unfeature(req: Request, res: Response) {
    send(res, true, await groupsService.featurePost(req.params.id!, req.user!.id, req.params.postId!, false), 'Post removido do feed.');
  },

  async pin(req: Request, res: Response) {
    send(res, true, await groupsService.pin(req.user!.id, req.params.id!), 'Comunidade fixada.');
  },

  async unpin(req: Request, res: Response) {
    send(res, true, await groupsService.unpin(req.user!.id, req.params.id!), 'Comunidade desafixada.');
  },
};
