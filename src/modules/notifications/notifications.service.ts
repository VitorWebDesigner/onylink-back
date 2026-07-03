import { query, queryOne } from '../../core/db';
import { notificationsModel as M } from './notifications.model';

export type NotificationType =
  | 'LIKE'
  | 'COMMENT'
  | 'CONNECTION'
  | 'MESSAGE'
  | 'POST_APPROVED'
  | 'POST_REJECTED';

/**
 * Helper compartilhado: outros módulos importam isto para criar notificações.
 * Ex.: import { createNotification } from '../notifications/notifications.service'
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await query(M.insert(), [userId, type, JSON.stringify(payload)]);
}

export const notificationsService = {
  async list(userId: string, limit = 30, offset = 0) {
    return query(M.list(), [userId, limit, offset]);
  },

  async unreadCount(userId: string) {
    const row = await queryOne<{ count: number }>(M.unreadCount(), [userId]);
    return { count: row?.count ?? 0 };
  },

  async markRead(userId: string, id: string) {
    await query(M.markRead(), [id, userId]);
    return { read: true };
  },

  async markAllRead(userId: string) {
    await query(M.markAllRead(), [userId]);
    return { read: true };
  },
};
