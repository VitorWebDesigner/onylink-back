import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { opportunitiesService } from './opportunities.service';
import { listOpportunityQuery, type ApplyOpportunityInput, type CreateOpportunityInput, type OpportunityCommentInput, type UpdateApplicationInput } from './opportunities.schema';

export const opportunitiesController = {
  async create(req: Request, res: Response) {
    const data = await opportunitiesService.create(req.user!.id, body<CreateOpportunityInput>(req));
    send(res, true, data, 'Oportunidade publicada!');
  },

  async list(req: Request, res: Response) {
    const q = listOpportunityQuery.parse(req.query);
    const data = await opportunitiesService.list(q, req.user?.id);
    send(res, true, data, 'ok');
  },

  async byId(req: Request, res: Response) {
    const data = await opportunitiesService.byId(req.params.id!, req.user?.id);
    send(res, true, data, 'ok');
  },

  async remove(req: Request, res: Response) {
    const data = await opportunitiesService.remove(req.params.id!, req.user!.id);
    send(res, true, data, 'Oportunidade removida.');
  },

  async mine(req: Request, res: Response) {
    send(res, true, await opportunitiesService.mine(req.user!.id), 'ok');
  },

  async apply(req: Request, res: Response) {
    const data = await opportunitiesService.apply(req.params.id!, req.user!.id, body<ApplyOpportunityInput>(req));
    send(res, true, data, 'Candidatura enviada!');
  },

  async applications(req: Request, res: Response) {
    const data = await opportunitiesService.listApplications(req.params.id!, req.user!.id);
    send(res, true, data, 'ok');
  },

  async updateApplication(req: Request, res: Response) {
    const data = await opportunitiesService.updateApplication(req.params.appId!, req.user!.id, body<UpdateApplicationInput>(req));
    send(res, true, data, 'Candidatura atualizada.');
  },

  async like(req: Request, res: Response) {
    send(res, true, await opportunitiesService.like(req.params.id!, req.user!.id), 'ok');
  },
  async unlike(req: Request, res: Response) {
    send(res, true, await opportunitiesService.unlike(req.params.id!, req.user!.id), 'ok');
  },
  async insight(req: Request, res: Response) {
    send(res, true, await opportunitiesService.insight(req.params.id!, req.user!.id), 'ok');
  },
  async uninsight(req: Request, res: Response) {
    send(res, true, await opportunitiesService.uninsight(req.params.id!, req.user!.id), 'ok');
  },
  async view(req: Request, res: Response) {
    send(res, true, await opportunitiesService.recordView(req.params.id!, req.user!.id), 'ok');
  },
  async subscribe(req: Request, res: Response) {
    send(res, true, await opportunitiesService.subscribe(req.params.id!, req.user!.id), 'Você será notificado sobre esta oportunidade.');
  },
  async unsubscribe(req: Request, res: Response) {
    send(res, true, await opportunitiesService.unsubscribe(req.params.id!, req.user!.id), 'ok');
  },

  async listComments(req: Request, res: Response) {
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };
    const data = await opportunitiesService.listComments(req.params.id!, req.user?.id, Number(cursor) || 0, Number(limit) || 50);
    send(res, true, data, 'ok');
  },
  async addComment(req: Request, res: Response) {
    const { content, parentId } = body<OpportunityCommentInput>(req);
    const data = await opportunitiesService.addComment(req.params.id!, req.user!.id, content, parentId);
    send(res, true, data, 'Comentário publicado.');
  },

  async likeComment(req: Request, res: Response) {
    send(res, true, await opportunitiesService.likeComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async unlikeComment(req: Request, res: Response) {
    send(res, true, await opportunitiesService.unlikeComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async insightComment(req: Request, res: Response) {
    send(res, true, await opportunitiesService.insightComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async uninsightComment(req: Request, res: Response) {
    send(res, true, await opportunitiesService.uninsightComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async repostComment(req: Request, res: Response) {
    send(res, true, await opportunitiesService.repostComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async unrepostComment(req: Request, res: Response) {
    send(res, true, await opportunitiesService.unrepostComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async shareComment(req: Request, res: Response) {
    send(res, true, await opportunitiesService.shareComment(req.params.commentId!, req.user!.id), 'ok');
  },
  async unshareComment(req: Request, res: Response) {
    send(res, true, await opportunitiesService.unshareComment(req.params.commentId!, req.user!.id), 'ok');
  },
};
