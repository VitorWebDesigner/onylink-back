import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { usersService } from './users.service';
import { postsService } from '../posts/posts.service';
import { opportunitiesService } from '../opportunities/opportunities.service';
import type { UpdateProfileInput } from './users.schema';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export const usersController = {
  async me(req: Request, res: Response) {
    send(res, true, await usersService.getProfile(req.user!.id, req.user!.id), 'ok');
  },
  async updateMe(req: Request, res: Response) {
    const data = await usersService.updateProfile(req.user!.id, body<UpdateProfileInput>(req));
    send(res, true, data, 'Perfil atualizado!');
  },
  /** Painel do Empresário (só o próprio — decisão plano-perfil.md §5.2). */
  async myInsights(req: Request, res: Response) {
    send(res, true, await usersService.insights(req.user!.id), 'ok');
  },
  async search(req: Request, res: Response) {
    const { q, limit, offset } = body<{ q: string; limit: number; offset: number }>(req);
    send(res, true, await usersService.search(q, limit, offset, req.user?.id), 'ok');
  },
  async byId(req: Request, res: Response) {
    send(res, true, await usersService.getProfile(req.params.id!, req.user?.id), 'ok');
  },
  /** Aba Publicações do perfil — mesma forma do feed (PostCard direto no front). */
  async posts(req: Request, res: Response) {
    const { limit, offset } = body<{ limit: number; offset: number }>(req);
    send(res, true, await postsService.listByAuthor(req.user?.id ?? NIL_UUID, req.params.id!, limit, offset), 'ok');
  },
  /** Aba Reposts — posts repostados pelo usuário, na ordem do repost. */
  async reposts(req: Request, res: Response) {
    const { limit, offset } = body<{ limit: number; offset: number }>(req);
    send(res, true, await postsService.listRepostedBy(req.user?.id ?? NIL_UUID, req.params.id!, limit, offset), 'ok');
  },
  /** Aba Respostas — comentários do usuário com contexto do post. */
  async comments(req: Request, res: Response) {
    const { limit, offset } = body<{ limit: number; offset: number }>(req);
    send(res, true, await usersService.comments(req.params.id!, limit, offset), 'ok');
  },
  /** Aba Mídia — grade de imagens/vídeos dos posts do usuário. */
  async media(req: Request, res: Response) {
    const { limit, offset } = body<{ limit: number; offset: number }>(req);
    send(res, true, await usersService.media(req.params.id!, limit, offset), 'ok');
  },
  /** Aba Oportunidades — oportunidades publicadas pelo usuário. */
  async opportunities(req: Request, res: Response) {
    const { limit, offset } = body<{ limit: number; offset: number }>(req);
    send(res, true, await opportunitiesService.listByAuthor(req.params.id!, req.user?.id ?? NIL_UUID, limit, offset), 'ok');
  },
  /** Listas de rede (stats tocáveis). */
  async followers(req: Request, res: Response) {
    const { limit, offset } = body<{ limit: number; offset: number }>(req);
    send(res, true, await usersService.followers(req.params.id!, req.user?.id ?? NIL_UUID, limit, offset), 'ok');
  },
  async following(req: Request, res: Response) {
    const { limit, offset } = body<{ limit: number; offset: number }>(req);
    send(res, true, await usersService.following(req.params.id!, req.user?.id ?? NIL_UUID, limit, offset), 'ok');
  },
};
