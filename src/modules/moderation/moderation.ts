/**
 * Módulo moderation (compacto). Denúncias + ações + classificador de posts.
 * O classificador é heurístico por enquanto (// TODO: trocar por endpoint de IA, CLAUDE §20).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../core/db';
import { ApiError, send } from '../../core/http';
import { decodePayload } from '../../middlewares/payload';
import { validate, validateQuery, body } from '../../middlewares/validate';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';
import { notify } from '../notifications/notifications.service';
import { logger } from '../../core/logger';

/* ── schemas ── */
const reportSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'USER', 'MESSAGE']),
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});
const resolveSchema = z.object({
  action: z.enum(['APPROVE', 'REMOVE', 'WARN', 'SUSPEND', 'BAN', 'LIMIT_REACH', 'BLOCK_MESSAGES']),
  notes: z.string().max(500).optional(),
  suspendDays: z.coerce.number().int().min(1).max(365).optional(),
});

/* ── model ── */
const M = {
  insertReport: () => `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4) RETURNING id`,
  listReports: () => `SELECT * FROM reports WHERE status = $1 ORDER BY created_at LIMIT $2 OFFSET $3`,
  getReport: () => `SELECT * FROM reports WHERE id = $1`,
  setReportStatus: () => `UPDATE reports SET status = $2 WHERE id = $1`,
  insertLog: () => `INSERT INTO moderation_logs (moderator_id, target_type, target_id, action, notes) VALUES ($1,$2,$3,$4,$5)`,
  rejectPost: () => `UPDATE posts SET status = 'REJECTED' WHERE id = $1`,
  suspendUser: () => `UPDATE users SET suspended_until = now() + ($2 || ' days')::interval WHERE id = $1`,
  banUser: () => `UPDATE users SET active = false WHERE id = $1`,
  setPostStatus: () => `UPDATE posts SET status = $2, moderation_score = $3, moderation_reason = $4 WHERE id = $1 RETURNING author_id`,
};

/* ── classificador (heurístico) ──
 * Usado pelo worker da fila 'moderation'. Decide APPROVED / NEEDS_REVIEW / REJECTED.
 */
const BANNED = [/\bgolpe\b/i, /pirâmide/i, /ganhe dinheiro fácil/i, /nudes?/i, /onlyfans/i, /\bxxx\b/i];
const REVIEW = [/compre agora/i, /promo[çc][aã]o imperd[ií]vel/i, /clique no link/i, /whats(app)? \d/i];

export interface Classification { status: 'APPROVED' | 'NEEDS_REVIEW' | 'REJECTED'; score: number; reason: string | null }

export function classifyContent(content: string): Classification {
  if (BANNED.some((re) => re.test(content))) return { status: 'REJECTED', score: 0.95, reason: 'Conteúdo fora das regras (golpe/sexual/spam).' };
  if (REVIEW.some((re) => re.test(content))) return { status: 'NEEDS_REVIEW', score: 0.6, reason: 'Possível autopromoção excessiva.' };
  if (content.trim().length < 8) return { status: 'NEEDS_REVIEW', score: 0.5, reason: 'Conteúdo muito curto / pouco contexto.' };
  return { status: 'APPROVED', score: 0.1, reason: null };
}

/** Classifica um post e persiste o status; notifica o autor. Chamado pelo worker. */
export async function classifyPost(postId: string, content: string): Promise<void> {
  const c = classifyContent(content);
  const row = await queryOne<{ author_id: string }>(M.setPostStatus(), [postId, c.status, c.score, c.reason]);
  if (row) {
    if (c.status === 'APPROVED') await notify(row.author_id, 'POST_APPROVED', { postId }).catch(() => {});
    if (c.status === 'REJECTED') await notify(row.author_id, 'POST_REJECTED', { postId, reason: c.reason }).catch(() => {});
  }
  logger.debug({ postId, status: c.status }, 'post classificado');
}

/* ── service ── */
const service = {
  report(reporterId: string, i: z.infer<typeof reportSchema>) {
    return queryOne(M.insertReport(), [reporterId, i.targetType, i.targetId, i.reason]);
  },
  async listReports(status = 'OPEN', cursor = 0, limit = 30) {
    const items = await query(M.listReports(), [status, limit, cursor]);
    return { items, nextCursor: items.length === limit ? cursor + limit : null };
  },
  async resolve(moderatorId: string, reportId: string, i: z.infer<typeof resolveSchema>) {
    const report = await queryOne<{ target_type: string; target_id: string }>(M.getReport(), [reportId]);
    if (!report) throw new ApiError('Denúncia não encontrada.', 404);

    await query(M.insertLog(), [moderatorId, report.target_type, report.target_id, i.action, i.notes ?? null]);

    if (i.action === 'REMOVE' && report.target_type === 'POST') await query(M.rejectPost(), [report.target_id]);
    if (i.action === 'SUSPEND' && report.target_type === 'USER') await query(M.suspendUser(), [report.target_id, String(i.suspendDays ?? 7)]);
    if (i.action === 'BAN' && report.target_type === 'USER') await query(M.banUser(), [report.target_id]);

    await query(M.setReportStatus(), [reportId, i.action === 'APPROVE' ? 'DISMISSED' : 'RESOLVED']);
    return { id: reportId, action: i.action };
  },
};

const pageSchema = z.object({ status: z.string().default('OPEN'), cursor: z.coerce.number().default(0), limit: z.coerce.number().default(30) });

const router = Router();
router.post('/report', requireAuth, decodePayload, validate(reportSchema), asyncHandler(async (req: Request, res: Response) => {
  send(res, true, await service.report(req.user!.id, body(req)), 'Denúncia registrada. Obrigado!');
}));
router.get('/reports', requireAuth, requireRole('ADMIN'), validateQuery(pageSchema), asyncHandler(async (req: Request, res: Response) => {
  const q = body<z.infer<typeof pageSchema>>(req);
  send(res, true, await service.listReports(q.status, q.cursor, q.limit), 'ok');
}));
router.post('/reports/:id/resolve', requireAuth, requireRole('ADMIN'), decodePayload, validate(resolveSchema), asyncHandler(async (req: Request, res: Response) => {
  send(res, true, await service.resolve(req.user!.id, req.params.id!, body(req)), 'Denúncia resolvida.');
}));

export default router;
