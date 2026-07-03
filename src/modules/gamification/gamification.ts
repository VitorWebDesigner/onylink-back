/** Módulo gamification (compacto). Exporta awardPoints/grantBadge usados por outros módulos. */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../core/db';
import { send } from '../../core/http';
import { validateQuery, body } from '../../middlewares/validate';
import { requireAuth, optionalAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';

const M = {
  insertPointEvent: () => `INSERT INTO point_events (user_id, reason, points) VALUES ($1,$2,$3)`,
  bumpPoints: () => `UPDATE profiles SET points = points + $2 WHERE user_id = $1`,
  grantBadge: () => `INSERT INTO user_badges (user_id, badge_id)
                     SELECT $1, b.id FROM badges b WHERE b.code = $2 ON CONFLICT DO NOTHING`,
  myBadges: () => `SELECT b.code, b.name, b.description, b.icon, ub.granted_at
                   FROM user_badges ub JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = $1`,
  ranking: () => `SELECT u.id, u.name, pr.avatar_path, pr.segment, pr.city, pr.points
                  FROM profiles pr JOIN users u ON u.id = pr.user_id
                  WHERE u.active = true
                    AND ($1::text IS NULL OR pr.segment = $1)
                    AND ($2::text IS NULL OR pr.city = $2)
                  ORDER BY pr.points DESC LIMIT $3 OFFSET $4`,
};

/** Soma pontos e registra o evento (atômico). Regras de pontuação em CLAUDE §16. */
export async function awardPoints(userId: string, reason: string, points: number): Promise<void> {
  await withTransaction(async (c) => {
    await c.query(M.insertPointEvent(), [userId, reason, points]);
    await c.query(M.bumpPoints(), [userId, points]);
  });
}

export async function grantBadge(userId: string, code: string): Promise<void> {
  await query(M.grantBadge(), [userId, code]);
}

const rankSchema = z.object({
  scope: z.enum(['geral', 'grupo', 'segmento', 'cidade']).default('geral'),
  segment: z.string().optional(),
  city: z.string().optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const router = Router();
router.get('/ranking', optionalAuth, validateQuery(rankSchema), asyncHandler(async (req: Request, res: Response) => {
  const q = body<z.infer<typeof rankSchema>>(req);
  const items = await query(M.ranking(), [q.segment ?? null, q.city ?? null, q.limit, q.cursor]);
  send(res, true, { items, nextCursor: items.length === q.limit ? q.cursor + q.limit : null }, 'ok');
}));
router.get('/me/badges', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  send(res, true, await query(M.myBadges(), [req.user!.id]), 'ok');
}));

export default router;
