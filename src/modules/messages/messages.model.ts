/**
 * SQL do módulo messages — FASE B: conversas HÍBRIDAS (1:1 e grupo de chat).
 * 1:1 mantém o par normalizado user_a < user_b (dedupe por UNIQUE).
 * Não lidas = mensagens de OUTROS após MEU conversation_members.last_read_at
 * (mesmo modelo do group_reads das comunidades).
 */

// Seleção padrão de uma conversa na visão do usuário $1 (peer p/ 1:1, última
// mensagem, não lidas, papel, fixada). Reutilizada na lista e no detalhe.
const CONV_SELECT = `
    SELECT c.id, c.is_group, c.name, c.description, c.photo_path, c.member_count,
           c.created_by, c.last_message_at, c.created_at,
           cm.role AS my_role,
           pu.id AS peer_id, pu.name AS peer_name, pu.handle AS peer_handle,
           pp.avatar_path AS peer_avatar,
           lm.content AS last_content, lm.sender_id AS last_sender_id, lm.created_at AS last_created_at,
           (SELECT count(*) FROM messages m
             WHERE m.conversation_id = c.id AND m.sender_id <> $1
               AND m.created_at > cm.last_read_at)::int AS unread_count,
           EXISTS (SELECT 1 FROM user_pins up WHERE up.user_id = $1
                   AND up.kind = CASE WHEN c.is_group THEN 'group' ELSE 'conversation' END
                   AND up.target_id = c.id) AS pinned
    FROM conversation_members cm
    JOIN conversations c ON c.id = cm.conversation_id
    LEFT JOIN conversation_members cm2
      ON NOT c.is_group AND cm2.conversation_id = c.id AND cm2.user_id <> $1
    LEFT JOIN users pu ON pu.id = cm2.user_id
    LEFT JOIN profiles pp ON pp.user_id = pu.id
    LEFT JOIN LATERAL (
      SELECT m2.content, m2.sender_id, m2.created_at FROM messages m2
      WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1
    ) lm ON true
    WHERE cm.user_id = $1`;

export const messagesModel = {
  list: () => `${CONV_SELECT}
    ORDER BY pinned DESC, COALESCE(c.last_message_at, c.created_at) DESC
    LIMIT $2 OFFSET $3`,

  byIdFor: () => `${CONV_SELECT} AND c.id = $2 LIMIT 1`,

  /* 1:1 — par normalizado (user_a < user_b) */
  findDm: () => `SELECT id FROM conversations WHERE user_a = $1 AND user_b = $2 LIMIT 1`,
  insertDm: () => `
    INSERT INTO conversations (user_a, user_b, is_group, member_count)
    VALUES ($1, $2, false, 2)
    ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = EXCLUDED.user_a
    RETURNING id`,

  /* grupo de chat (estilo WhatsApp, máx 150 — gate no service) */
  insertGroup: () => `
    INSERT INTO conversations (is_group, name, description, photo_path, created_by, member_count)
    VALUES (true, $1, $2, $3, $4, $5)
    RETURNING id`,
  updateGroup: () => `
    UPDATE conversations SET
      name        = COALESCE($2, name),
      description = COALESCE($3, description),
      photo_path  = COALESCE($4, photo_path)
    WHERE id = $1 AND is_group RETURNING id`,
  transferOwnership: () => `UPDATE conversations SET created_by = $2 WHERE id = $1`,

  /* membros */
  addMember: () => `
    INSERT INTO conversation_members (conversation_id, user_id, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (conversation_id, user_id) DO NOTHING
    RETURNING conversation_id`,
  removeMember: () => `
    DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2
    RETURNING conversation_id`,
  memberRole: () => `SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1`,
  setRole: () => `UPDATE conversation_members SET role = $3 WHERE conversation_id = $1 AND user_id = $2 RETURNING user_id`,
  memberIds: () => `SELECT user_id FROM conversation_members WHERE conversation_id = $1`,
  syncMemberCount: () => `
    UPDATE conversations c
    SET member_count = (SELECT count(*) FROM conversation_members cm WHERE cm.conversation_id = c.id)
    WHERE c.id = $1`,
  members: () => `
    SELECT u.id, u.name, u.handle, p.avatar_path, p.role_title, cm.role, cm.joined_at,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followee_id = u.id) AS followed
    FROM conversation_members cm
    JOIN users u ON u.id = cm.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE cm.conversation_id = $1
    ORDER BY (cm.role = 'ADMIN') DESC, cm.joined_at ASC
    LIMIT 200`,

  /* mensagens */
  listMessages: () => `
    SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at,
           u.name AS sender_name, p.avatar_path AS sender_avatar
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN profiles p ON p.user_id = m.sender_id
    WHERE m.conversation_id = $1
    ORDER BY m.created_at DESC
    LIMIT $2 OFFSET $3`,
  insertMessage: () => `
    INSERT INTO messages (conversation_id, sender_id, content)
    VALUES ($1, $2, $3)
    RETURNING id, conversation_id, sender_id, content, created_at`,
  touchConversation: () => `UPDATE conversations SET last_message_at = now() WHERE id = $1`,
  markRead: () => `
    UPDATE conversation_members SET last_read_at = now()
    WHERE conversation_id = $1 AND user_id = $2`,
  // menor last_read entre os OUTROS membros → "lida" (✓✓) das minhas mensagens
  othersMinRead: () => `
    SELECT min(last_read_at) AS min_read FROM conversation_members
    WHERE conversation_id = $1 AND user_id <> $2`,

  /* fixar (user_pins genérica — kind 'conversation' | 'group', máx 5 por tipo) */
  addPin: () => `INSERT INTO user_pins (user_id, kind, target_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
  removePin: () => `DELETE FROM user_pins WHERE user_id = $1 AND kind = $2 AND target_id = $3`,
  countPins: () => `SELECT count(*)::int AS n FROM user_pins WHERE user_id = $1 AND kind = $2`,
};
