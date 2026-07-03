import { query, queryOne } from '../../core/db';
import { ApiError } from '../../core/http';
import { opportunitiesModel as M } from './opportunities.model';
import type { ApplyOpportunityInput, CreateOpportunityInput, ListOpportunityQuery, UpdateApplicationInput } from './opportunities.schema';

const NIL = '00000000-0000-0000-0000-000000000000';

export const opportunitiesService = {
  async create(authorId: string, input: CreateOpportunityInput) {
    // Entra como APPROVED (sem moderação IA — ver opportunities.model).
    return queryOne(M.insert(), [
      authorId,
      input.kind,
      input.title,
      input.description ?? null,
      input.city ?? null,
      input.segment ?? null,
      JSON.stringify(input.applicationForm ?? []),
    ]);
  },

  mine(userId: string, limit = 50, offset = 0) {
    return query(M.mine(), [userId, limit, offset]);
  },

  /** Oportunidades publicadas por um autor (aba Oportunidades do perfil). */
  listByAuthor(authorId: string, viewerId: string, limit = 20, offset = 0) {
    return query(M.byAuthor(), [authorId, viewerId, limit, offset]);
  },

  async apply(id: string, userId: string, input: ApplyOpportunityInput) {
    const row = await queryOne<{ id: string }>(M.apply(), [id, userId, JSON.stringify(input.answers ?? [])]);
    return { id: row?.id ?? null, applied: true };
  },

  async listApplications(id: string, userId: string, cursor = 0, limit = 50) {
    const owner = await queryOne<{ author_id: string }>(M.authorOf(), [id]);
    if (!owner) throw new ApiError('Oportunidade não encontrada.', 404);
    if (owner.author_id !== userId) throw new ApiError('Sem permissão.', 403);
    return query(M.listApplications(), [id, limit, cursor]);
  },

  async updateApplication(appId: string, userId: string, input: UpdateApplicationInput) {
    const row = await queryOne(M.updateApplication(), [appId, userId, input.status ?? null, input.reply ?? null]);
    if (!row) throw new ApiError('Candidatura não encontrada ou sem permissão.', 404);
    return row;
  },

  list(q: ListOpportunityQuery, userId?: string) {
    return query(M.list(), [
      q.kind ?? null,
      q.city ? `%${q.city}%` : null,
      q.segment ? `%${q.segment}%` : null,
      q.limit,
      q.offset,
      userId ?? NIL,
    ]);
  },

  async byId(id: string, userId?: string) {
    const row = await queryOne(M.byId(), [id, userId ?? NIL]);
    if (!row) throw new ApiError('Oportunidade não encontrada.', 404);
    return row;
  },

  async remove(id: string, userId: string) {
    const row = await queryOne<{ id: string }>(M.delete(), [id, userId]);
    if (!row) throw new ApiError('Oportunidade não encontrada ou sem permissão.', 404);
    return { id: row.id };
  },

  async like(id: string, userId: string) {
    await query(M.like(), [id, userId]);
    return { liked: true };
  },
  async unlike(id: string, userId: string) {
    await query(M.unlike(), [id, userId]);
    return { liked: false };
  },
  async insight(id: string, userId: string) {
    await query(M.insight(), [id, userId]);
    return { insighted: true };
  },
  async uninsight(id: string, userId: string) {
    await query(M.uninsight(), [id, userId]);
    return { insighted: false };
  },

  async recordView(id: string, userId: string) {
    const inserted = await queryOne(M.recordView(), [id, userId]);
    if (inserted) await query(M.bumpView(), [id, 1]);
    const row = await queryOne<{ view_count: number }>(M.getViewCount(), [id]);
    return { viewCount: row?.view_count ?? 0 };
  },
  async subscribe(id: string, userId: string) {
    await query(M.subscribe(), [id, userId]);
    return { subscribed: true };
  },
  async unsubscribe(id: string, userId: string) {
    await query(M.unsubscribe(), [id, userId]);
    return { subscribed: false };
  },

  listComments(id: string, viewerId?: string, cursor = 0, limit = 50) {
    return query(M.listComments(), [id, viewerId ?? NIL, limit, cursor]);
  },
  async addComment(id: string, authorId: string, content: string, parentId?: string) {
    const c = await queryOne<{ id: string; parent_id: string | null }>(M.addComment(), [id, authorId, content, parentId ?? null]);
    if (parentId) await query(M.bumpReply(), [parentId, 1]);
    return c;
  },

  async likeComment(commentId: string, userId: string) {
    const r = await queryOne(M.likeComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentLike(), [commentId, 1]);
    return { liked: true };
  },
  async unlikeComment(commentId: string, userId: string) {
    const r = await queryOne(M.unlikeComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentLike(), [commentId, -1]);
    return { liked: false };
  },
  async insightComment(commentId: string, userId: string) {
    const r = await queryOne(M.insightComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentInsight(), [commentId, 1]);
    return { insighted: true };
  },
  async uninsightComment(commentId: string, userId: string) {
    const r = await queryOne(M.uninsightComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentInsight(), [commentId, -1]);
    return { insighted: false };
  },
  async repostComment(commentId: string, userId: string) {
    const r = await queryOne(M.repostComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentRepost(), [commentId, 1]);
    return { reposted: true };
  },
  async unrepostComment(commentId: string, userId: string) {
    const r = await queryOne(M.unrepostComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentRepost(), [commentId, -1]);
    return { reposted: false };
  },
  async shareComment(commentId: string, userId: string) {
    const r = await queryOne(M.shareComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentShare(), [commentId, 1]);
    return { shared: true };
  },
  async unshareComment(commentId: string, userId: string) {
    const r = await queryOne(M.unshareComment(), [commentId, userId]);
    if (r) await query(M.bumpCommentShare(), [commentId, -1]);
    return { shared: false };
  },
};
