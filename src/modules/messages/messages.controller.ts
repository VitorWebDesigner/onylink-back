import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { messagesService } from './messages.service';
import type { SendMessageInput } from './messages.schema';

export const messagesController = {
  async listConversations(req: Request, res: Response) {
    const data = await messagesService.listConversations(
      req.user!.id,
      Number(req.query.limit ?? 30),
      Number(req.query.offset ?? 0),
    );
    send(res, true, data, 'ok');
  },

  async getMessages(req: Request, res: Response) {
    const data = await messagesService.getMessages(
      req.user!.id,
      req.params.id!,
      Number(req.query.limit ?? 50),
      Number(req.query.offset ?? 0),
    );
    send(res, true, data, 'ok');
  },

  async sendMessage(req: Request, res: Response) {
    const { content } = body<SendMessageInput>(req);
    const data = await messagesService.send(req.user!.id, req.params.userId!, content);
    send(res, true, data, 'Mensagem enviada.');
  },
};
