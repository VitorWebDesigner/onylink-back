import { queryOne, withTransaction } from '../../core/db';
import { ApiError } from '../../core/http';
import { companiesModel as M } from './companies.model';
import type { CompanyInput } from './companies.schema';

const args = (i: CompanyInput) => [
  i.name, i.segment ?? null, i.description ?? null, i.website ?? null,
  i.city ?? null, i.state ?? null, i.employeesBand ?? null, i.area ?? null, i.logoPath ?? null,
];

export const companiesService = {
  async create(userId: string, input: CompanyInput) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(M.insert(), args(input));
      const company = rows[0]!;
      await client.query(M.linkToProfile(), [userId, company.id]);
      return company;
    });
  },

  async byId(id: string) {
    const c = await queryOne(M.byId(), [id]);
    if (!c) throw new ApiError('Empresa não encontrada.', 404);
    return c;
  },

  async update(userId: string, id: string, input: CompanyInput) {
    const owner = await queryOne(M.isOwner(), [userId, id]);
    if (!owner) throw new ApiError('Você não pode editar esta empresa.', 403);
    return queryOne(M.update(), [id, ...args(input)]);
  },
};
