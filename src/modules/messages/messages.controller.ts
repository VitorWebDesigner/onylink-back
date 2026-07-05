import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { messagesService } from './messages.service';
import type { AddMembersInput, CreateChatGroupInput, SendMessageInput, UpdateChatGroupInput } from './messages.schema';

export const messagesController = {
  async list(req: Request, res: Response) {
    const data = await messagesService.list(req.user!.id, Number(req.query.limit ?? 50), Number(req.query.offset ?? 0));
    send(res, true, data, 'ok');
  },

  async openDm(req: Request, res: Response) {
    send(res, true, await messagesService.openDm(req.user!.id, req.params.userId!), 'ok');
  },

  async createGroup(req: Request, res: Response) {
    const data = await messagesService.createGroup(req.user!.id, body<CreateChatGroupInput>(req));
    send(res, true, data, 'Grupo criado!');
  },

  async detail(req: Request, res: Response) {
    send(res, true, await messagesService.detail(req.user!.id, req.params.id!), 'ok');
  },

  async updateGroup(req: Request, res: Response) {
    const data = await messagesService.updateGroup(req.user!.id, req.params.id!, body<UpdateChatGroupInput>(req));
    send(res, true, data, 'Grupo atualizado.');
  },

  async messages(req: Request, res: Response) {
    const data = await messagesService.messages(
      req.user!.id, req.params.id!, Number(req.query.limit ?? 40), Number(req.query.cursor ?? 0),
    );
    send(res, true, data, 'ok');
  },

  async sendMessage(req: Request, res: Response) {
    const { content } = body<SendMessageInput>(req);
    send(res, true, await messagesService.send(req.user!.id, req.params.id!, content), 'ok');
  },

  async markRead(req: Request, res: Response) {
    send(res, true, await messagesService.markRead(req.user!.id, req.params.id!), 'ok');
  },

  async addMembers(req: Request, res: Response) {
    const data = await messagesService.addMembers(req.user!.id, req.params.id!, body<AddMembersInput>(req));
    send(res, true, data, 'Participantes adicionados.');
  },

  async removeMember(req: Request, res: Response) {
    const data = await messagesService.removeMember(req.user!.id, req.params.id!, req.params.userId!);
    send(res, true, data, 'ok');
  },

  async promote(req: Request, res: Response) {
    send(res, true, await messagesService.promote(req.user!.id, req.params.id!, req.params.userId!), 'Agora é admin do grupo.');
  },

  async transfer(req: Request, res: Response) {
    send(res, true, await messagesService.transferOwnership(req.user!.id, req.params.id!, req.params.userId!), 'Propriedade transferida.');
  },

  async pin(req: Request, res: Response) {
    send(res, true, await messagesService.pin(req.user!.id, req.params.id!), 'Fixado.');
  },
  async unpin(req: Request, res: Response) {
    send(res, true, await messagesService.unpin(req.user!.id, req.params.id!), 'Desafixado.');
  },
};
