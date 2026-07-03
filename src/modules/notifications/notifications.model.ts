/** SQL do módulo notifications (tabela: user_id, type, payload jsonb — 001 + índices 018). */
export const notificationsModel = {
  // ON CONFLICT DO NOTHING cobre os índices únicos parciais (reação/follow — 018).
  insert: () => `
    INSERT INTO notifications (user_id, type, payload)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING`,

  // "des-toggle" (descurtir/desrepostar/tirar insight) apaga a notificação da reação
  deleteReaction: () => `
    DELETE FROM notifications
    WHERE type = $1 AND payload->>'actorId' = $2 AND payload->>'postId' = $3`,

  deleteFollow: () => `
    DELETE FROM notifications
    WHERE user_id = $1 AND type = 'FOLLOW' AND payload->>'actorId' = $2`,

  // $1=userId, $2=limit, $3=offset — junta o ATOR (nome/handle/avatar) via payload
  list: () => `
    SELECT n.id, n.type, n.payload, n.read_at, n.created_at,
           a.id AS actor_id, a.name AS actor_name, a.handle AS actor_handle,
           pr.avatar_path AS actor_avatar
    FROM notifications n
    LEFT JOIN users a ON a.id::text = n.payload->>'actorId'
    LEFT JOIN profiles pr ON pr.user_id = a.id
    WHERE n.user_id = $1
    ORDER BY n.created_at DESC
    LIMIT $2 OFFSET $3`,

  unreadCount: () => `
    SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,

  markRead: () => `
    UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 RETURNING id`,

  markAllRead: () => `
    UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`,

  /* lookups p/ descobrir destinatários da emissão */
  postAuthor: () => `SELECT author_id FROM posts WHERE id = $1`,
  commentAuthor: () => `SELECT author_id FROM comments WHERE id = $1`,
  postSubscribers: () => `SELECT user_id FROM post_subscriptions WHERE post_id = $1 LIMIT 500`,
  opportunityMeta: () => `SELECT author_id, title FROM opportunities WHERE id = $1`,
};
