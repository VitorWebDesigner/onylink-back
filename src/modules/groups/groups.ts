/**
 * Módulo groups (compacto: schema + model + service + controller + routes num arquivo).
 * Grupos por tema/segmento; criação restrita a ADMIN (CLAUDE §8).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query, queryOne, withTransaction } from '../../core/db';
import { ApiError, send } from '../../core/http';
import { decodePayload } from '../../middlewares/payload';
import { validate, validateQuery, body } from '../../middlewares/validate';
import { requireAuth, requireRole, optionalAuth } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/error';

/* ── schema ── */
const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, 'slug deve ser kebab-case'),
  description: z.string().max(1000).optional(),
  segment: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  isPremium: z.boolean().optional(),
});
const listSchema = z.object({
  segment: z.string().optional(),
  city: z.string().optional(),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/* ── model ── */
const M = {
  insert: () => `INSERT INTO groups (name, slug, description, segment, city, is_premium, created_by)
                 VALUES ($1,$2,$3,$4,$5,COALESCE($6,false),$7) RETURNING *`,
  list: () => `SELECT id, name, slug, description, segment, city, is_premium, member_count
               FROM groups
               WHERE ($1::text IS NULL OR segment = $1) AND ($2::text IS NULL OR city = $2)
               ORDER BY member_count DESC, created_at DESC LIMIT $3 OFFSET $4`,
  bySlug: () => `SELECT * FROM groups WHERE slug = $1`,
  join: () => `INSERT INTO group_members (group_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING group_id`,
  leave: () => `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING group_id`,
  bumpMembers: () => `UPDATE groups SET member_count = member_count + $2 WHERE id = $1`,
  members: () => `SELECT gm.user_id, gm.role, u.name, pr.avatar_path, pr.segment, pr.city
                  FROM group_members gm JOIN users u ON u.id = gm.user_id
                  LEFT JOIN profiles pr ON pr.user_id = gm.user_id
                  WHERE gm.group_id = $1 ORDER BY gm.joined_at LIMIT $2 OFFSET $3`,
};

/* ── service ── */
const service = {
  async create(creatorId: string, i: z.infer<typeof createSchema>) {
    const existing = await queryOne(M.bySlug(), [i.slug]);
    if (existing) throw new ApiError('Slug já em uso.', 409);
    return queryOne(M.insert(), [i.name, i.slug, i.description ?? null, i.segment ?? null, i.city ?? null, i.isPremium ?? false, creatorId]);
  },
  async list(q: z.infer<typeof listSchema>) {
    const items = await query(M.list(), [q.segment ?? null, q.city ?? null, q.limit, q.cursor]);
    return { items, nextCursor: items.length === q.limit ? q.cursor + q.limit : null };
  },
  async detail(slug: string) {
    const g = await queryOne(M.bySlug(), [slug]);
    if (!g) throw new ApiError('Grupo não encontrado.', 404);
    return g;
  },
  async join(groupId: string, userId: string) {
    await withTransaction(async (c) => {
      const { rows } = await c.query(M.join(), [groupId, userId]);
      if (rows[0]) await c.query(M.bumpMembers(), [groupId, 1]);
    });
    return { joined: true };
  },
  async leave(groupId: string, userId: string) {
    await withTransaction(async (c) => {
      const { rows } = await c.query(M.leave(), [groupId, userId]);
      if (rows[0]) await c.query(M.bumpMembers(), [groupId, -1]);
    });
    return { joined: false };
  },
  members(groupId: string, cursor = 0, limit = 30) {
    return query(M.members(), [groupId, limit, cursor]);
  },
};

/* ── routes ── */
const router = Router();
router.get('/', optionalAuth, validateQuery(listSchema), asyncHandler(async (req: Request, res: Response) => {
  send(res, true, await service.list(body(req)), 'ok');
}));
router.get('/:slug', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  send(res, true, await service.detail(req.params.slug!), 'ok');
}));
router.get('/:id/members', requireAuth, validateQuery(z.object({ cursor: z.coerce.number().default(0), limit: z.coerce.number().default(30) })), asyncHandler(async (req: Request, res: Response) => {
  const { cursor, limit } = body<{ cursor: number; limit: number }>(req);
  send(res, true, await service.members(req.params.id!, cursor, limit), 'ok');
}));
router.post('/', requireAuth, requireRole('ADMIN'), decodePayload, validate(createSchema), asyncHandler(async (req: Request, res: Response) => {
  send(res, true, await service.create(req.user!.id, body(req)), 'Grupo criado.');
}));
router.post('/:id/join', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  send(res, true, await service.join(req.params.id!, req.user!.id), 'Você entrou no grupo.');
}));
router.post('/:id/leave', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  send(res, true, await service.leave(req.params.id!, req.user!.id), 'Você saiu do grupo.');
}));

export default router;
