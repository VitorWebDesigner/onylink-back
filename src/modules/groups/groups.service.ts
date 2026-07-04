import { query, queryOne, withTransaction } from '../../core/db';
import { ApiError } from '../../core/http';
import { notifyEvents } from '../notifications/notifications.service';
import { groupsModel as M } from './groups.model';
import type { CreateGroupInput, ListGroupsInput, UpdateGroupInput } from './groups.schema';

/** Posts dentro da comunidade são do módulo `posts` (posts.group_id). */

const NIL = '00000000-0000-0000-0000-000000000000';
const MAX_MEMBERS = 200; // decisão plano-grupos-comunidades.md §5.2
const MAX_PINS = 5;      // decisão §5.4

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function requireAdmin(groupId: string, userId: string): Promise<void> {
  const r = await queryOne<{ role: string }>(M.memberRole(), [groupId, userId]);
  if (r?.role !== 'ADMIN') throw new ApiError('Só o admin da comunidade pode fazer isso.', 403);
}

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

  /** Detalhe por id OU slug, com joined/my_role/requested/pinned do viewer. */
  async detail(idOrSlug: string, viewerId?: string) {
    const group = await queryOne(M.detail(), [idOrSlug, viewerId ?? NIL]);
    if (!group) throw new ApiError('Comunidade não encontrada.', 404);
    return group;
  },

  async create(input: CreateGroupInput, createdBy: string) {
    // Criação: ADMIN ou conta PROFISSIONAL (CLAUDE.md §8).
    const u = await queryOne<{ role: string; professional: boolean }>(M.canCreate(), [createdBy]);
    if (!u || (u.role !== 'ADMIN' && !u.professional)) {
      throw new ApiError('Criação de comunidades disponível para contas profissionais.', 403);
    }
    let slug = slugify(input.name);
    if (!slug) slug = `comunidade-${Date.now()}`;
    try {
      // cria com o CRIADOR já como MEMBRO-ADMIN
      return await withTransaction(async (client) => {
        const { rows } = await client.query(M.insert(), [
          input.name,
          slug,
          input.description ?? null,
          input.segment ?? null,
          input.city ?? null,
          input.coverPath ?? null,
          input.isPremium ?? false,
          input.isPrivate ?? false,
          createdBy,
        ]);
        const group = rows[0] as { id: string };
        await client.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'ADMIN') ON CONFLICT DO NOTHING`, [group.id, createdBy]);
        await client.query(M.bumpMemberCount(), [group.id, 1]);
        return { ...group, member_count: 1, joined: true, my_role: 'ADMIN' };
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('Já existe uma comunidade com esse nome.', 409);
    }
  },

  /** Edição (nome/descrição/segmento/cidade/foto/privacidade) — só admin. */
  async update(groupId: string, userId: string, input: UpdateGroupInput) {
    await requireAdmin(groupId, userId);
    const row = await queryOne(M.update(), [
      groupId,
      input.name ?? null,
      input.description ?? null,
      input.segment ?? null,
      input.city ?? null,
      input.coverPath ?? null,
      input.isPrivate ?? null,
    ]);
    if (!row) throw new ApiError('Comunidade não encontrada.', 404);
    return row;
  },

  /**
   * Entrar: pública → direto (limite 200); privada → cria PEDIDO (admin aprova).
   */
  async join(groupId: string, userId: string) {
    const group = await queryOne<{ id: string; name: string; is_private: boolean; member_count: number }>(M.byId(), [groupId]);
    if (!group) throw new ApiError('Comunidade não encontrada.', 404);
    if (group.member_count >= MAX_MEMBERS) throw new ApiError(`Comunidade cheia (máx. ${MAX_MEMBERS} membros).`, 409);

    if (group.is_private) {
      const r = await queryOne(M.addRequest(), [groupId, userId]);
      if (r) void notifyEvents.joinRequest(groupId, group.name, userId);
      return { joined: false, requested: true };
    }

    return withTransaction(async (client) => {
      const { rows } = await client.query(M.addMember(), [groupId, userId]);
      if (rows.length > 0) await client.query(M.bumpMemberCount(), [groupId, 1]);
      return { joined: true, requested: false };
    });
  },

  async leave(groupId: string, userId: string) {
    // DONO (created_by) não sai: precisa transferir a propriedade antes (decisão do dono).
    const owner = await queryOne<{ created_by: string }>(M.ownerOf(), [groupId]);
    if (owner?.created_by === userId) {
      throw new ApiError('Você é o dono da comunidade. Transfira a propriedade para outro admin antes de sair.', 409);
    }
    return withTransaction(async (client) => {
      const { rows } = await client.query(M.removeMember(), [groupId, userId]);
      if (rows.length > 0) await client.query(M.bumpMemberCount(), [groupId, -1]);
      // pedido pendente (se privada) também é cancelado
      await client.query(M.deleteRequest(), [groupId, userId]);
      return { left: true };
    });
  },

  /** Promove um membro a ADMIN (só admin pode). */
  async promote(groupId: string, adminId: string, targetId: string) {
    await requireAdmin(groupId, adminId);
    const row = await queryOne(M.setRole(), [groupId, targetId, 'ADMIN']);
    if (!row) throw new ApiError('Membro não encontrado.', 404);
    return { promoted: true };
  },

  /** Transfere a PROPRIEDADE (created_by) — só o dono; alvo vira/continua ADMIN. */
  async transferOwnership(groupId: string, ownerId: string, targetId: string) {
    const owner = await queryOne<{ created_by: string }>(M.ownerOf(), [groupId]);
    if (!owner) throw new ApiError('Comunidade não encontrada.', 404);
    if (owner.created_by !== ownerId) throw new ApiError('Só o dono pode transferir a propriedade.', 403);
    if (ownerId === targetId) throw new ApiError('Você já é o dono.', 400);
    const isMember = await queryOne(M.isMember(), [groupId, targetId]);
    if (!isMember) throw new ApiError('O novo dono precisa ser membro da comunidade.', 400);
    return withTransaction(async (client) => {
      await client.query(M.setRole(), [groupId, targetId, 'ADMIN']);
      await client.query(M.transferOwnership(), [groupId, targetId]);
      return { transferred: true };
    });
  },

  async members(groupId: string, viewerId: string, limit = 50, offset = 0) {
    return query(M.members(), [groupId, viewerId, limit, offset]);
  },

  /** Admin remove um membro. */
  async removeMember(groupId: string, adminId: string, targetId: string) {
    await requireAdmin(groupId, adminId);
    if (adminId === targetId) throw new ApiError('Use "Sair da comunidade" para se remover.', 400);
    return withTransaction(async (client) => {
      const { rows } = await client.query(M.removeMember(), [groupId, targetId]);
      if (rows.length > 0) await client.query(M.bumpMemberCount(), [groupId, -1]);
      return { removed: true };
    });
  },

  /* ——— pedidos de entrada (privada) ——— */
  async listRequests(groupId: string, adminId: string) {
    await requireAdmin(groupId, adminId);
    return query(M.listRequests(), [groupId]);
  },

  async approveRequest(groupId: string, adminId: string, targetId: string) {
    await requireAdmin(groupId, adminId);
    const group = await queryOne<{ name: string; member_count: number }>(M.byId(), [groupId]);
    if (!group) throw new ApiError('Comunidade não encontrada.', 404);
    if (group.member_count >= MAX_MEMBERS) throw new ApiError(`Comunidade cheia (máx. ${MAX_MEMBERS} membros).`, 409);
    return withTransaction(async (client) => {
      const del = await client.query(M.deleteRequest(), [groupId, targetId]);
      if (!del.rows.length) throw new ApiError('Pedido não encontrado.', 404);
      const { rows } = await client.query(M.addMember(), [groupId, targetId]);
      if (rows.length > 0) await client.query(M.bumpMemberCount(), [groupId, 1]);
      void notifyEvents.joinApproved(groupId, group.name, targetId, adminId);
      return { approved: true };
    });
  },

  async rejectRequest(groupId: string, adminId: string, targetId: string) {
    await requireAdmin(groupId, adminId);
    await query(M.deleteRequest(), [groupId, targetId]);
    return { rejected: true };
  },

  /* ——— repost pro feed geral (admin escolhe posts da comunidade) ——— */
  async featurePost(groupId: string, adminId: string, postId: string, on: boolean) {
    await requireAdmin(groupId, adminId);
    const row = await queryOne(on ? M.featurePost() : M.unfeaturePost(), on ? [postId, groupId, adminId] : [postId, groupId]);
    if (!row) throw new ApiError('Post não encontrado nesta comunidade.', 404);
    return { featured: on };
  },

  /* ——— fixar comunidade (máx. 5) ——— */
  async pin(userId: string, targetId: string, kind: 'community' | 'group' | 'conversation' = 'community') {
    const c = await queryOne<{ n: number }>(M.countPins(), [userId, kind]);
    if ((c?.n ?? 0) >= MAX_PINS) throw new ApiError(`Máximo de ${MAX_PINS} fixados.`, 409);
    await query(M.addPin(), [userId, kind, targetId]);
    return { pinned: true };
  },

  async unpin(userId: string, targetId: string, kind: 'community' | 'group' | 'conversation' = 'community') {
    await query(M.removePin(), [userId, kind, targetId]);
    return { pinned: false };
  },
};
