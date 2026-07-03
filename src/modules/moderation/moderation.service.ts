import { query, queryOne } from '../../core/db';
import { ApiError } from '../../core/http';
import { enqueue } from '../../core/queue';
import { logger } from '../../core/logger';
import { moderationModel as M } from './moderation.model';
import type { PostDecisionInput, ReportInput, ResolveReportInput } from './moderation.schema';

/**
 * Palavras/temas fora do propósito empresarial (heurística inicial).
 * A moderação real por IA substitui isto — ver classifyAndApply().
 */
const BANNED = ['xxx', 'nude', 'pelada', 'aposta', 'esquema', 'pirâmide', 'ganhe dinheiro fácil', 'compre seguidores'];

export const moderationService = {
  async report(reporterId: string, input: ReportInput) {
    return queryOne(M.insertReport(), [reporterId, input.targetType, input.targetId, input.reason]);
  },

  async listReports(status: string | null, limit = 50, offset = 0) {
    return query(M.listReports(), [status, limit, offset]);
  },

  async resolveReport(reportId: string, moderatorId: string, input: ResolveReportInput) {
    const updated = await queryOne<{ id: string; target_type: string; target_id: string; status: string }>(
      M.setReportStatus(),
      [reportId, input.status],
    );
    if (!updated) throw new ApiError('Denúncia não encontrada.', 404);
    if (input.action) {
      await query(M.insertLog(), [
        moderatorId,
        updated.target_type,
        updated.target_id,
        input.action,
        input.notes ?? null,
      ]);
    }
    return updated;
  },

  async decidePost(postId: string, moderatorId: string, input: PostDecisionInput) {
    const post = await queryOne<{ id: string }>(M.getPost(), [postId]);
    if (!post) throw new ApiError('Post não encontrado.', 404);
    const updated = await queryOne(M.setPostStatus(), [postId, input.status, input.reason ?? null, null]);
    const action = input.status === 'APPROVED' ? 'APPROVE' : input.status === 'REJECTED' ? 'REMOVE' : 'WARN';
    await query(M.insertLog(), [moderatorId, 'POST', postId, action, input.reason ?? null]);
    return updated;
  },

  /**
   * Passo de moderação automática chamado pelo worker da fila 'moderation'
   * (ver core/queue.ts). HOJE: heurística simples de banned-words/tamanho.
   * TODO(IA): trocar por chamada ao endpoint de classificação de conteúdo
   * (Claude) — classificar relevância empresarial + toxicidade + spam e
   * preencher moderation_score real (0..1). Ver CLAUDE.md §8 (fluxo criar post).
   */
  async classifyAndApply(postId: string) {
    const post = await queryOne<{ id: string; content: string }>(M.getPost(), [postId]);
    if (!post) return;
    const text = (post.content ?? '').toLowerCase();
    const hasBanned = BANNED.some((w) => text.includes(w));
    const tooShort = text.trim().length < 8;

    const status = hasBanned ? 'REJECTED' : tooShort ? 'NEEDS_REVIEW' : 'APPROVED';
    const score = hasBanned ? 0.95 : tooShort ? 0.5 : 0.1; // confiança de "problemático"
    const reason = hasBanned ? 'Conteúdo fora do propósito empresarial' : tooShort ? 'Conteúdo muito curto' : null;

    await query(M.setPostStatus(), [postId, status, reason, score]);
    logger.debug({ postId, status }, 'moderação automática aplicada');

    // Notifica o autor sobre aprovação/rejeição (fan-out via fila).
    await enqueue('notifications', 'post_decision', { postId, status }).catch(() => undefined);
    return { postId, status };
  },
};
