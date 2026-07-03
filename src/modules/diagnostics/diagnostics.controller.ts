import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { diagnosticsService } from './diagnostics.service';
import type { CreateDiagnosticInput } from './diagnostics.schema';

export const diagnosticsController = {
  async create(req: Request, res: Response) {
    const data = await diagnosticsService.create(body<CreateDiagnosticInput>(req), req.user?.id ?? null);
    send(res, true, data, 'Diagnóstico concluído!');
  },

  async latest(req: Request, res: Response) {
    const data = await diagnosticsService.latestForUser(req.user!.id);
    send(res, true, data ?? {}, 'ok');
  },
};
