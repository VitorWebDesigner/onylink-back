export const connectionsModel = {
  follow: () => `
    INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2)
    ON CONFLICT DO NOTHING`,
  unfollow: () => `DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`,

  requestConnection: () => `
    INSERT INTO connections (requester_id, addressee_id, status) VALUES ($1,$2,'PENDING')
    ON CONFLICT (requester_id, addressee_id) DO NOTHING
    RETURNING *`,
  accept: () => `
    UPDATE connections SET status = 'ACCEPTED'
    WHERE id = $1 AND addressee_id = $2 AND status = 'PENDING' RETURNING *`,
  reject: () => `DELETE FROM connections WHERE id = $1 AND addressee_id = $2 AND status = 'PENDING'`,
  remove: () => `
    DELETE FROM connections WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)`,

  myConnections: () => `
    SELECT c.id, c.status,
           u.id AS user_id, u.name, p.avatar_path, p.role_title, p.segment, p.city
    FROM connections c
    JOIN users u ON u.id = CASE WHEN c.requester_id = $1 THEN c.addressee_id ELSE c.requester_id END
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE (c.requester_id = $1 OR c.addressee_id = $1) AND c.status = 'ACCEPTED'
    ORDER BY c.updated_at DESC`,

  pending: () => `
    SELECT c.id, u.id AS user_id, u.name, p.avatar_path, p.role_title, p.segment, p.city, c.created_at
    FROM connections c
    JOIN users u ON u.id = c.requester_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE c.addressee_id = $1 AND c.status = 'PENDING'
    ORDER BY c.created_at DESC`,

  // Sugestões "por afinidade" com um usuário-semente ($4): pessoas do MESMO
  // segmento/cidade que ele ($2/$3), que EU ($1) ainda não sigo, exclui a semente.
  // Se a semente não tem segmento/cidade, cai em recomendação geral por pontos.
  suggestionsLike: () => `
    SELECT u.id, u.name, u.handle, p.avatar_path, p.role_title, p.segment, p.city
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE u.active = true AND u.id <> $1 AND u.id <> $4
      AND (
        ($2::text IS NOT NULL AND p.segment = $2)
        OR ($3::text IS NOT NULL AND p.city = $3)
        OR ($2::text IS NULL AND $3::text IS NULL)
      )
      AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id)
    ORDER BY COALESCE((p.segment = $2), false)::int DESC,
             COALESCE((p.city = $3), false)::int DESC,
             p.points DESC
    LIMIT $5`,

  // Recomendados: mesmo segmento ou cidade, ainda não conectados, exclui o próprio.
  recommended: () => `
    SELECT u.id, u.name, p.avatar_path, p.role_title, p.segment, p.city, p.points
    FROM users u
    JOIN profiles p ON p.user_id = u.id
    WHERE u.active = true AND u.id <> $1
      AND (p.segment = $2 OR p.city = $3)
      AND NOT EXISTS (
        SELECT 1 FROM connections c
        WHERE (c.requester_id = $1 AND c.addressee_id = u.id)
           OR (c.addressee_id = $1 AND c.requester_id = u.id))
    ORDER BY (p.segment = $2)::int DESC, p.points DESC
    LIMIT 20`,
};
