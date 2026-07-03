/** SQL do módulo notifications. */
export const notificationsModel = {
  insert: () => `
    INSERT INTO notifications (user_id, type, payload)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, type, payload, read_at, created_at`,

  list: () => `
    SELECT id, type, payload, read_at, created_at
    FROM notifications WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,

  unreadCount: () => `
    SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,

  markRead: () => `
    UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 RETURNING id`,

  markAllRead: () => `
    UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`,
};
