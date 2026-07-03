import { query, queryOne, withTransaction } from '../../core/db';
import { ApiError } from '../../core/http';
import { groupsModel as M } from './groups.model';
import type { CreateGroupInput, ListGroupsInput } from './groups.schema';

/** Posts dentro de um grupo são tratados pelo módulo `posts` via posts.group_id. */

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const NIL = '00000000-0000-0000-0000-000000000000';

export const groupsService = {
  async list(input: ListGroupsInput, viewerId?: string) {
    return query(M.list(), [
      input.segment ?? null,
      input.city ?? null,
      viewerId ?? NIL,
      input.mine ?? false,
      input.limit,
      input.offset,
    ]);
  },

  /** Detalhe por id OU slug, com `joined` do viewer. */
  async detail(idOrSlug: string, viewerId?: string) {
    const group = await queryOne(M.detail(), [idOrSlug, viewerId ?? NIL]);
    if (!group) throw new ApiError('Grupo não encontrado.', 404);
    return group;
  },

  async create(input: CreateGroupInput, createdBy: string) {
    // Criação: ADMIN ou conta PROFISSIONAL (ajuste p/ a fase atual — CLAUDE.md §8).
    const u = await queryOne<{ role: string; professional: boolean }>(M.canCreate(), [createdBy]);
    if (!u || (u.role !== 'ADMIN' && !u.professional)) {
      throw new ApiError('Criação de grupos disponível para contas profissionais.', 403);
    }
    let slug = slugify(input.name);
    if (!slug) slug = `grupo-${Date.now()}`;
    try {
      // cria e já coloca o CRIADOR como membro (member_count = 1)
      return await withTransaction(async (client) => {
        const { rows } = await client.query(M.insert(), [
          input.name,
          slug,
          input.description ?? null,
          input.segment ?? null,
          input.city ?? null,
          input.coverPath ?? null,
          input.isPremium ?? false,
          createdBy,
        ]);
        const group = rows[0] as { id: string };
        await client.query(M.addMember(), [group.id, createdBy]);
        await client.query(M.bumpMemberCount(), [group.id, 1]);
        return { ...group, member_count: 1, joined: true };
      });
    } catch {
      throw new ApiError('Já existe um grupo com esse nome/slug.', 409);
    }
  },

  async join(groupId: string, userId: string) {
    const group = await queryOne<{ id: string }>(M.byId(), [groupId]);
    if (!group) throw new ApiError('Grupo não encontrado.', 404);
    return withTransaction(async (client) => {
      const { rows } = await client.query(M.addMember(), [groupId, userId]);
      if (rows.length > 0) await client.query(M.bumpMemberCount(), [groupId, 1]);
      return { joined: true };
    });
  },

  async leave(groupId: string, userId: string) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(M.removeMember(), [groupId, userId]);
      if (rows.length > 0) await client.query(M.bumpMemberCount(), [groupId, -1]);
      return { left: true };
    });
  },

  async members(groupId: string, limit = 50, offset = 0) {
    return query(M.members(), [groupId, limit, offset]);
  },
};
