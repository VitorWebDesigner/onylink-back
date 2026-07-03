/** SQL do módulo admin. */
export const adminModel = {
  listUsers: () => `
    SELECT u.id, u.name, u.email, u.role, u.active, u.suspended_until, u.created_at,
           p.segment, p.city, p.points
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1)
    ORDER BY u.created_at DESC
    LIMIT $2 OFFSET $3`,

  suspendUser: () => `
    UPDATE users SET suspended_until = now() + ($2 || ' days')::interval
    WHERE id = $1 RETURNING id, suspended_until`,
  banUser: () => `UPDATE users SET active = false WHERE id = $1 RETURNING id, active`,
  activateUser: () => `UPDATE users SET active = true, suspended_until = NULL WHERE id = $1 RETURNING id, active`,
  setRole: () => `UPDATE users SET role = $2 WHERE id = $1 RETURNING id, role`,

  pendingPosts: () => `
    SELECT p.id, p.author_id, p.category, p.content, p.status, p.created_at, u.name AS author_name
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE p.status IN ('PENDING', 'NEEDS_REVIEW')
    ORDER BY p.created_at ASC
    LIMIT $1 OFFSET $2`,

  /* métricas (uma query agregada por linha) */
  countUsers: () => `SELECT count(*)::int AS total FROM users`,
  countActiveUsers: () => `SELECT count(*)::int AS total FROM users WHERE active = true`,
  countPostsByStatus: () => `SELECT status, count(*)::int AS total FROM posts GROUP BY status`,
  countOpenReports: () => `SELECT count(*)::int AS total FROM reports WHERE status = 'OPEN'`,
  countActiveGroups: () => `SELECT count(*)::int AS total FROM groups WHERE member_count > 0`,
};
