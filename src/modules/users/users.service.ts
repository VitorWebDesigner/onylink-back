import { query, queryOne } from '../../core/db';
import { ApiError } from '../../core/http';
import { mediaUrl } from '../posts/posts.service';
import { usersModel as M } from './users.model';
import type { UpdateProfileInput } from './users.schema';

export const usersService = {
  async getProfile(userId: string, viewerId?: string) {
    const profile = await queryOne(M.publicProfile(), [userId, viewerId ?? '00000000-0000-0000-0000-000000000000']);
    if (!profile) throw new ApiError('Usuário não encontrado.', 404);
    return profile;
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    await query(M.ensureRow(), [userId]);
    if (input.name) await query(M.updateName(), [userId, input.name]);
    const updated = await queryOne(M.updateProfile(), [
      userId,
      input.avatarPath ?? null,
      input.bio ?? null,
      input.roleTitle ?? null,
      input.segment ?? null,
      input.city ?? null,
      input.state ?? null,
      input.interests ?? null,
      input.links ? JSON.stringify(input.links) : null,
      input.mainGoal ?? null,
      input.revenueBand ?? null,
      input.coverPath ?? null,
      input.contactEmail ?? null,
      input.contactWhatsapp ?? null,
      input.contactUrl ?? null,
    ]);
    const complete = await queryOne<{ profile_complete: boolean }>(M.recomputeComplete(), [userId]);
    return { ...updated, profile_complete: complete?.profile_complete ?? false };
  },

  async search(q: string, limit: number, offset: number, viewerId?: string) {
    return query(M.search(), [q, limit, offset, viewerId ?? '00000000-0000-0000-0000-000000000000']);
  },

  /** Painel do Empresário: métricas 30d + top posts + última nota de diagnóstico.
   *  SÓ contas PROFISSIONAIS (decisão plano-perfil.md §5/item 2 do dono). */
  async insights(userId: string) {
    const tier = await queryOne<{ professional: boolean }>(M.isProfessional(), [userId]);
    if (!tier?.professional) throw new ApiError('Recurso disponível apenas para contas profissionais.', 403);
    const [metrics, topPosts, diagnostic] = await Promise.all([
      queryOne(M.insights(), [userId]),
      query<{ media_type: string | null; media_path: string | null } & Record<string, unknown>>(M.topPosts(), [userId]),
      queryOne(M.latestDiagnostic(), [userId]),
    ]);
    // 1ª mídia do post vira thumbnail resolvida (Storage → URL CDN; vídeo → thumb assinada)
    const top = topPosts.map(({ media_type, media_path, ...p }) => ({
      ...p,
      media: media_type && media_path ? mediaUrl(media_type, media_path) : null,
    }));
    return { ...metrics, top_posts: top, diagnostic };
  },

  /** Aba Respostas do perfil (comentários do usuário com contexto do post). */
  comments(userId: string, limit = 20, offset = 0) {
    return query(M.commentsByAuthor(), [userId, limit, offset]);
  },

  /** Aba Mídia do perfil (grade). Resolve a URL de cada item. */
  async media(userId: string, limit = 30, offset = 0) {
    const rows = await query<{ post_id: string; type: string; path: string }>(M.mediaByAuthor(), [userId, limit, offset]);
    return rows.map((r) => ({ post_id: r.post_id, ...mediaUrl(r.type, r.path) }));
  },

  /** Listas de rede (seguidores / seguindo). */
  followers(userId: string, viewerId: string, limit = 50, offset = 0) {
    return query(M.followers(), [userId, viewerId, limit, offset]);
  },
  following(userId: string, viewerId: string, limit = 50, offset = 0) {
    return query(M.following(), [userId, viewerId, limit, offset]);
  },
};
