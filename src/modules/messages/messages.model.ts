/**
 * SQL do módulo messages. conversations tem CHECK(user_a < user_b):
 * sempre normalizar o par (menor uuid em user_a) antes de inserir/buscar.
 */
export const messagesModel = {
  findConversationByPair: () => `
    SELECT id, user_a, user_b, last_message_at
    FROM conversations WHERE user_a = $1 AND user_b = $2 LIMIT 1`,

  insertConversation: () => `
    INSERT INTO conversations (user_a, user_b) VALUES ($1, $2)
    ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = EXCLUDED.user_a
    RETURNING id, user_a, user_b`,

  conversationById: () => `
    SELECT id, user_a, user_b FROM conversations WHERE id = $1 LIMIT 1`,

  listConversations: () => `
    SELECT c.id, c.last_message_at,
           other.id   AS other_id,
           other.name AS other_name,
           p.avatar_path AS other_avatar,
           lm.content AS last_message,
           (SELECT count(*) FROM messages m
              WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread
    FROM conversations c
    JOIN users other ON other.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
    LEFT JOIN profiles p ON p.user_id = other.id
    LEFT JOIN LATERAL (
      SELECT content FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1
    ) lm ON true
    WHERE c.user_a = $1 OR c.user_b = $1
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT $2 OFFSET $3`,

  listMessages: () => `
    SELECT id, conversation_id, sender_id, content, read_at, created_at
    FROM messages WHERE conversation_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,

  insertMessage: () => `
    INSERT INTO messages (conversation_id, sender_id, content)
    VALUES ($1, $2, $3)
    RETURNING id, conversation_id, sender_id, content, read_at, created_at`,

  touchConversation: () => `UPDATE conversations SET last_message_at = now() WHERE id = $1`,

  markIncomingRead: () => `
    UPDATE messages SET read_at = now()
    WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
};
