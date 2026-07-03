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

export const groupsService = {
  async list(input: ListGroupsInput) {
    return query(M.list(), [input.segment ?? null, input.city ?? null, input.limit, input.offset]);
  },

  async bySlug(slug: string) {
    const group = await queryOne(M.bySlug(), [slug]);
    if (!group) throw new ApiError('Grupo não encontrado.', 404);
    return group;
  },

  async create(input: CreateGroupInput, createdBy: string) {
    let slug = slugify(input.name);
    if (!slug) slug = `grupo-${Date.now()}`;
    try {
      const rows = await query(M.insert(), [
        input.name,
        slug,
        input.description ?? null,
        input.segment ?? null,
        input.city ?? null,
        input.coverPath ?? null,
        input.isPremium ?? false,
        createdBy,
      ]);
      return rows[0];
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
