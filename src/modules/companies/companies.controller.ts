import type { Request, Response } from 'express';
import { send } from '../../core/http';
import { body } from '../../middlewares/validate';
import { companiesService } from './companies.service';
import type { CompanyInput } from './companies.schema';

export const companiesController = {
  async create(req: Request, res: Response) {
    send(res, true, await companiesService.create(req.user!.id, body<CompanyInput>(req)), 'Empresa criada!');
  },
  async byId(req: Request, res: Response) {
    send(res, true, await companiesService.byId(req.params.id!), 'ok');
  },
  async update(req: Request, res: Response) {
    send(res, true, await companiesService.update(req.user!.id, req.params.id!, body<CompanyInput>(req)), 'Empresa atualizada!');
  },
};
