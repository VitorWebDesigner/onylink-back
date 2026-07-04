/** SQL do módulo groups/COMUNIDADES. Funções puras → string parametrizada ($1,$2...). */
export const groupsModel = {
  // $3 = viewer (nil p/ guest) → `joined`/`pinned`; $4 = true → só as minhas.
  // Fixadas ($4=true das minhas OU lista geral) vêm PRIMEIRO (decisão §5.4).
  list: () => `
    SELECT g.id, g.name, g.slug, g.description, g.segment, g.city, g.cover_path,
           g.is_premium, g.is_private, g.member_count, g.created_at,
           EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $3) AS joined,
           EXISTS (SELECT 1 FROM group_join_requests r WHERE r.group_id = g.id AND r.user_id = $3) AS requested,
           EXISTS (SELECT 1 FROM user_pins up WHERE up.user_id = $3 AND up.kind = 'community' AND up.target_id = g.id) AS pinned,
           (CASE WHEN EXISTS (SELECT 1 FROM group_members ga WHERE ga.group_id = g.id AND ga.user_id = $3 AND ga.role = 'ADMIN')
                 THEN (SELECT count(*) FROM group_join_requests jr WHERE jr.group_id = g.id)
                 ELSE 0 END)::int AS pending_requests
    FROM groups g
    WHERE ($1::text IS NULL OR g.segment = $1)
      AND ($2::text IS NULL OR g.city = $2)
      AND ($4::boolean IS NOT TRUE OR EXISTS (
            SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $3))
    ORDER BY pinned DESC, g.member_count DESC, g.created_at DESC
    LIMIT $5 OFFSET $6`,

  // $1 = id OU slug. $2 = viewer → joined/role/requested/pinned.
  detail: () => `
    SELECT g.id, g.name, g.slug, g.description, g.segment, g.city, g.cover_path,
           g.is_premium, g.is_private, g.member_count, g.created_by, g.created_at,
           u.name AS creator_name,
           EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $2) AS joined,
           (SELECT gm.role FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $2) AS my_role,
           EXISTS (SELECT 1 FROM group_join_requests r WHERE r.group_id = g.id AND r.user_id = $2) AS requested,
           EXISTS (SELECT 1 FROM user_pins up WHERE up.user_id = $2 AND up.kind = 'community' AND up.target_id = g.id) AS pinned,
           (CASE WHEN EXISTS (SELECT 1 FROM group_members ga WHERE ga.group_id = g.id AND ga.user_id = $2 AND ga.role = 'ADMIN')
                 THEN (SELECT count(*) FROM group_join_requests jr WHERE jr.group_id = g.id)
                 ELSE 0 END)::int AS pending_requests
    FROM groups g
    LEFT JOIN users u ON u.id = g.created_by
    WHERE (g.id::text = $1 OR g.slug = $1)
    LIMIT 1`,

  byId: () => `SELECT id, name, slug, is_private, member_count FROM groups WHERE id = $1 LIMIT 1`,

  insert: () => `
    INSERT INTO groups (name, slug, description, segment, city, cover_path, is_premium, is_private, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, name, slug, description, segment, city, cover_path, is_premium, is_private, member_count, created_at`,

  // edição (só admin — gate no service). COALESCE = parcial.
  update: () => `
    UPDATE groups SET
      name        = COALESCE($2, name),
      description = COALESCE($3, description),
      segment     = COALESCE($4, segment),
      city        = COALESCE($5, city),
      cover_path  = COALESCE($6, cover_path),
      is_private  = COALESCE($7, is_private)
    WHERE id = $1
    RETURNING id, name, slug, description, segment, city, cover_path, is_premium, is_private, member_count, created_at`,

  isMember: () => `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
  memberRole: () => `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
  adminIds: () => `SELECT user_id FROM group_members WHERE group_id = $1 AND role = 'ADMIN'`,
  ownerOf: () => `SELECT created_by FROM groups WHERE id = $1`,
  setRole: () => `UPDATE group_members SET role = $3 WHERE group_id = $1 AND user_id = $2 RETURNING user_id`,
  transferOwnership: () => `UPDATE groups SET created_by = $2 WHERE id = $1`,

  addMember: () => `
    INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)
    ON CONFLICT (group_id, user_id) DO NOTHING
    RETURNING group_id`,

  removeMember: () => `
    DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING group_id`,

  bumpMemberCount: () => `UPDATE groups SET member_count = member_count + $2 WHERE id = $1`,

  // $2 = viewer → `followed` (botão Seguir no sheet de ações do membro)
  members: () => `
    SELECT u.id, u.name, u.handle, p.avatar_path, p.role_title, gm.role, gm.joined_at,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followee_id = u.id) AS followed
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE gm.group_id = $1
    ORDER BY (gm.role = 'ADMIN') DESC, gm.joined_at ASC
    LIMIT $3 OFFSET $4`,

  /* comunidade PRIVADA — pedidos de entrada */
  addRequest: () => `
    INSERT INTO group_join_requests (group_id, user_id) VALUES ($1, $2)
    ON CONFLICT DO NOTHING RETURNING group_id`,
  deleteRequest: () => `DELETE FROM group_join_requests WHERE group_id = $1 AND user_id = $2 RETURNING user_id`,
  listRequests: () => `
    SELECT u.id, u.name, u.handle, p.avatar_path, p.role_title, r.created_at
    FROM group_join_requests r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE r.group_id = $1
    ORDER BY r.created_at ASC
    LIMIT 100`,

  /* repost pro FEED GERAL (admin) — post da comunidade ganha featured_by/at */
  featurePost: () => `
    UPDATE posts SET featured_by = $3, featured_at = now()
    WHERE id = $1 AND group_id = $2 RETURNING id`,
  unfeaturePost: () => `
    UPDATE posts SET featured_by = NULL, featured_at = NULL
    WHERE id = $1 AND group_id = $2 RETURNING id`,

  /* fixar comunidade (máx. 5 por tipo — gate no service) */
  addPin: () => `
    INSERT INTO user_pins (user_id, kind, target_id) VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING`,
  removePin: () => `DELETE FROM user_pins WHERE user_id = $1 AND kind = $2 AND target_id = $3`,
  countPins: () => `SELECT count(*)::int AS n FROM user_pins WHERE user_id = $1 AND kind = $2`,

  canCreate: () => `SELECT role, professional FROM users WHERE id = $1`,
};
