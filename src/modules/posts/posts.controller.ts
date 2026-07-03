import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { postsService } from './posts.service';
import type { CommentInput, CreatePostInput, FeedQuery, UpdatePostInput } from './posts.schema';

export const postsController = {
  async create(req: Request, res: Response) {
    const data = await postsService.create(req.user!.id, body<CreatePostInput>(req));
    send(res, true, data, 'Publicado!');
  },

  async update(req: Request, res: Response) {
    const data = await postsService.update(req.params.id!, req.user!.id, body<UpdatePostInput>(req));
    send(res, true, data, 'Post atualizado.');
  },

  async remove(req: Request, res: Response) {
    const data = await postsService.remove(req.params.id!, req.user!.id);
    send(res, true, data, 'Post removido.');
  },

  async getOne(req: Request, res: Response) {
    const data = await postsService.getOne(req.params.id!);
    send(res, true, data, 'ok');
  },

  async feed(req: Request, res: Response) {
    const data = await postsService.feed(req.user?.id ?? '00000000-0000-0000-0000-000000000000', body<FeedQuery>(req));
    send(res, true, data, 'ok');
  },

  async search(req: Request, res: Response) {
    const q = String(req.query.q ?? '').trim();
    const viewerId = req.user?.id ?? '00000000-0000-0000-0000-000000000000';
    const data = q ? await postsService.searchPosts(viewerId, q) : { items: [], nextCursor: null };
    send(res, true, data, 'ok');
  },

  // Polling de contadores ao vivo (item 2). ?ids=uuid,uuid,... (máx 60, só uuids válidos).
  async live(req: Request, res: Response) {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = String(req.query.ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => UUID.test(s))
      .slice(0, 60);
    send(res, true, await postsService.liveCounts(ids), 'ok');
  },

  async like(req: Request, res: Response) {
    send(res, true, await postsService.like(req.params.id!, req.user!.id), 'ok');
  },
  async unlike(req: Request, res: Response) {
    send(res, true, await postsService.unlike(req.params.id!, req.user!.id), 'ok');
  },
  async repost(req: Request, res: Response) {
    send(res, true, await postsService.repost(req.params.id!, req.user!.id), 'ok');
  },
  async unrepost(req: Request, res: Response) {
    send(res, true, await postsService.unrepost(req.params.id!, req.user!.id), 'ok');
  },
  async share(req: Request, res: Response) {
    send(res, true, await postsService.share(req.params.id!, req.user!.id), 'ok');
  },
  async unshare(req: Request, res: Response) {
    send(res, true, await postsService.unshare(req.params.id!, req.user!.id), 'ok');
  },
  async insight(req: Request, res: Response) {
    send(res, true, await postsService.insight(req.params.id!, req.user!.id), 'ok');
  },
  async uninsight(req: Request, res: Response) {
    send(res, true, await postsService.uninsight(req.params.id!, req.user!.id), 'ok');
  },
  async view(req: Request, res: Response) {
    send(res, true, await postsService.recordView(req.params.id!, req.user!.id), 'ok');
  },
  async pin(req: Request, res: Response) {
    send(res, true, await postsService.pin(req.params.id!, req.user!.id), 'Post fixado no seu perfil.');
  },
  async unpin(req: Request, res: Response) {
    send(res, true, await postsService.unpin(req.params.id!, req.user!.id), 'Post desafixado.');
  },
  async subscribe(req: Request, res: Response) {
    send(res, true, await postsService.subscribe(req.params.id!, req.user!.id), 'Você será notificado sobre este post.');
  },
  async unsubscribe(req: Request, res: Response) {
    send(res, true, await postsService.unsubscribe(req.params.id!, req.user!.id), 'ok');
  },

  async save(req: Request, res: Response) {
    send(res, true, await postsService.save(req.params.id!, req.user!.id), 'Post salvo.');
  },
  async unsave(req: Request, res: Response) {
    send(res, true, await postsService.unsave(req.params.id!, req.user!.id), 'ok');
  },
  async listSaved(req: Request, res: Response) {
    const { cursor, limit } = body<{ cursor?: number; limit?: number }>(req) ?? {};
    send(res, true, await postsService.listSaved(req.user!.id, cursor, limit), 'ok');
  },

  async comment(req: Request, res: Response) {
    const data = await postsService.comment(req.params.id!, req.user!.id, body<CommentInput>(req));
    send(res, true, data, 'Comentário publicado.');
  },
  async listComments(req: Request, res: Response) {
    const cursor = Number(req.query.cursor) || 0;
    const limit = Number(req.query.limit) || 50;
    const viewerId = req.user?.id ?? '00000000-0000-0000-0000-000000000000';
    send(res, true, await postsService.listComments(req.params.id!, viewerId, cursor, limit), 'ok');
  },
  async removeComment(req: Request, res: Response) {
    send(res, true, await postsService.removeComment(req.params.commentId!, req.user!.id), 'Comentário removido.');
  },

  async likeComment(req: Request, res: Response) {
    send(res, true, await postsService.likeComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async unlikeComment(req: Request, res: Response) {
    send(res, true, await postsService.unlikeComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async insightComment(req: Request, res: Response) {
    send(res, true, await postsService.insightComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async uninsightComment(req: Request, res: Response) {
    send(res, true, await postsService.uninsightComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async repostComment(req: Request, res: Response) {
    send(res, true, await postsService.repostComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async unrepostComment(req: Request, res: Response) {
    send(res, true, await postsService.unrepostComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async shareComment(req: Request, res: Response) {
    send(res, true, await postsService.shareComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async unshareComment(req: Request, res: Response) {
    send(res, true, await postsService.unshareComment(req.params.commentId!, req.user!.id), 'ok');
  },
};
