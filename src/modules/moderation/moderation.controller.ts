import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { moderationService } from './moderation.service';
import type { PostDecisionInput, ReportInput, ResolveReportInput } from './moderation.schema';

export const moderationController = {
  async report(req: Request, res: Response) {
    const data = await moderationService.report(req.user!.id, body<ReportInput>(req));
    send(res, true, data, 'Denúncia registrada. Obrigado!');
  },

  async listReports(req: Request, res: Response) {
    const status = (req.query.status as string) || null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const data = await moderationService.listReports(status, limit, offset);
    send(res, true, data, 'ok');
  },

  async resolveReport(req: Request, res: Response) {
    const data = await moderationService.resolveReport(req.params.id!, req.user!.id, body<ResolveReportInput>(req));
    send(res, true, data, 'Denúncia atualizada.');
  },

  async decidePost(req: Request, res: Response) {
    const data = await moderationService.decidePost(req.params.id!, req.user!.id, body<PostDecisionInput>(req));
    send(res, true, data, 'Decisão aplicada.');
  },
};
