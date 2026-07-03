import { z } from 'zod';

/** Filtros do ranking (GET /ranking) — usado por validateQuery se desejado. */
export const rankingQuerySchema = z.object({
  scope: z.enum(['geral', 'grupo']).default('geral'),
  groupId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type RankingQuery = z.infer<typeof rankingQuerySchema>;
