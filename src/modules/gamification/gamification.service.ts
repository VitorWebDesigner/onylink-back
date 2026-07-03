import { query, queryOne, withTransaction } from '../../core/db';
import { logger } from '../../core/logger';
import { gamificationModel as M } from './gamification.model';

/** Tabela de pontos por ação (referência única). */
export const POINTS = {
  PROFILE_COMPLETED: 50,
  POST_CREATED: 10,
  COMMENT: 3,
  RECEIVED_LIKE: 1,
  CONNECTION_MADE: 5,
  CASE_PUBLISHED: 20,
  REFERRAL: 15,
} as const;
export type PointReason = keyof typeof POINTS;

export const gamificationService = {
  /** Credita pontos: grava o evento e incrementa profiles.points (atômico). */
  async awardPoints(userId: string, reason: PointReason, points = POINTS[reason]) {
    return withTransaction(async (client) => {
      await client.query(M.insertPointEvent(), [userId, reason, points]);
      const { rows } = await client.query<{ points: number }>(M.addPoints(), [userId, points]);
      return rows[0]?.points ?? null;
    });
  },

  /** Concede um selo pelo código (idempotente). */
  async grantBadge(userId: string, badgeCode: string) {
    const badge = await queryOne<{ id: string }>(M.badgeByCode(), [badgeCode]);
    if (!badge) {
      logger.warn({ badgeCode }, 'badge inexistente');
      return false;
    }
    await query(M.grantBadge(), [userId, badge.id]);
    return true;
  },

  listBadges() {
    return query(M.listBadges());
  },

  myBadges(userId: string) {
    return query(M.myBadges(), [userId]);
  },

  async ranking(scope: 'geral' | 'grupo', groupId: string | null, limit = 50) {
    if (scope === 'grupo' && groupId) return query(M.rankingByGroup(), [groupId, limit]);
    return query(M.rankingGeral(), [limit]);
  },
};
