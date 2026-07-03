/** SQL do módulo gamification. */
export const gamificationModel = {
  insertPointEvent: () => `
    INSERT INTO point_events (user_id, reason, points) VALUES ($1, $2, $3)`,

  addPoints: () => `
    UPDATE profiles SET points = points + $2 WHERE user_id = $1
    RETURNING points`,

  badgeByCode: () => `SELECT id FROM badges WHERE code = $1 LIMIT 1`,

  grantBadge: () => `
    INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2)
    ON CONFLICT (user_id, badge_id) DO NOTHING`,

  listBadges: () => `SELECT id, code, name, description, icon FROM badges ORDER BY name`,

  myBadges: () => `
    SELECT b.id, b.code, b.name, b.description, b.icon, ub.granted_at
    FROM user_badges ub
    JOIN badges b ON b.id = ub.badge_id
    WHERE ub.user_id = $1
    ORDER BY ub.granted_at DESC`,

  rankingGeral: () => `
    SELECT u.id, u.name, p.avatar_path, p.segment, p.city, p.points
    FROM profiles p
    JOIN users u ON u.id = p.user_id
    WHERE u.active = true
    ORDER BY p.points DESC
    LIMIT $1`,

  rankingByGroup: () => `
    SELECT u.id, u.name, p.avatar_path, p.segment, p.city, p.points
    FROM group_members gm
    JOIN profiles p ON p.user_id = gm.user_id
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = $1 AND u.active = true
    ORDER BY p.points DESC
    LIMIT $2`,
};
