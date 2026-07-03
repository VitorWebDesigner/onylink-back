import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { connectionsService as S } from './connections.service';

export const connectionsController = {
  follow: async (req: Request, res: Response) =>
    send(res, true, await S.follow(req.user!.id, req.params.userId!), 'Seguindo.'),
  unfollow: async (req: Request, res: Response) =>
    send(res, true, await S.unfollow(req.user!.id, req.params.userId!), 'Deixou de seguir.'),
  request: async (req: Request, res: Response) =>
    send(res, true, await S.request(req.user!.id, req.params.userId!), 'Convite enviado!'),
  accept: async (req: Request, res: Response) =>
    send(res, true, await S.accept(req.user!.id, req.params.id!), 'Conexão aceita!'),
  reject: async (req: Request, res: Response) =>
    send(res, true, await S.reject(req.user!.id, req.params.id!), 'Convite recusado.'),
  remove: async (req: Request, res: Response) =>
    send(res, true, await S.remove(req.user!.id, req.params.id!), 'Conexão removida.'),
  list: async (req: Request, res: Response) => send(res, true, await S.list(req.user!.id), 'ok'),
  pending: async (req: Request, res: Response) => send(res, true, await S.pending(req.user!.id), 'ok'),
  recommended: async (req: Request, res: Response) => send(res, true, await S.recommended(req.user!.id), 'ok'),
  suggestions: async (req: Request, res: Response) =>
    send(res, true, await S.suggestions(req.user!.id, req.params.userId!), 'ok'),
};
