/** Módulo notifications (compacto). Exporta notify() usado por outros módulos/workers. */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../core/db';
import { send } from '../../core/http';
import { validateQuery, body } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';

export type NotificationType =
  | 'LIKE' | 'COMMENT' | 'CONNECTION' | 'CONNECTION_ACCEPTED' | 'MESSAGE' | 'POST_APPROVED' | 'POST_REJECTED';

const M = {
  insert: () => `INSERT INTO notifications (user_id, type, payload) VALUES ($1,$2,$3) RETURNING id`,
  list: () => `SELECT id, type, payload, read_at, created_at FROM notifications
               WHERE user_id = $1 ORDER BY (read_at IS NOT NULL), created_at DESC LIMIT $2 OFFSET $3`,
  read: () => `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2`,
  readAll: () => `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`,
  unread: () => `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
};

/** Cria uma notificação. Best-effort: chame com .catch() em fluxos não-críticos. */
export async function notify(userId: string, type: NotificationType, payload: Record<string, unknown> = {}): Promise<void> {
  await query(M.insert(), [userId, type, JSON.stringify(payload)]);
}

const pageSchema = z.object({ cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(50).default(20) });

const router = Router();
router.get('/', requireAuth, validateQuery(pageSchema), asyncHandler(async (req: Request, res: Response) => {
  const { cursor, limit } = body<{ cursor: number; limit: number }>(req);
  const items = await query(M.list(), [req.user!.id, limit, cursor]);
  send(res, true, { items, nextCursor: items.length === limit ? cursor + limit : null }, 'ok');
}));
router.get('/unread-count', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const row = await queryOne<{ n: number }>(M.unread(), [req.user!.id]);
  send(res, true, { count: row?.n ?? 0 }, 'ok');
}));
router.post('/:id/read', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  await query(M.read(), [req.params.id!, req.user!.id]);
  send(res, true, {}, 'ok');
}));
router.post('/read-all', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  await query(M.readAll(), [req.user!.id]);
  send(res, true, {}, 'ok');
}));

export default router;
