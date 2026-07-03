/** SQL do módulo groups. Funções puras → string parametrizada ($1,$2...). */
export const groupsModel = {
  // $3 = viewer (nil p/ guest) → `joined`; $4 = true → SÓ os grupos do viewer ("Meus grupos").
  list: () => `
    SELECT g.id, g.name, g.slug, g.description, g.segment, g.city, g.cover_path,
           g.is_premium, g.member_count, g.created_at,
           EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $3) AS joined
    FROM groups g
    WHERE ($1::text IS NULL OR g.segment = $1)
      AND ($2::text IS NULL OR g.city = $2)
      AND ($4::boolean IS NOT TRUE OR EXISTS (
            SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = $3))
    ORDER BY g.member_count DESC, g.created_at DESC
    LIMIT $5 OFFSET $6`,

  // $1 = id OU slug (a tela navega por id; links futuros podem usar slug).
  detail: () => `
    SELECT g.id, g.name, g.slug, g.description, g.segment, g.city, g.cover_path,
           g.is_premium, g.member_count, g.created_by, g.created_at,
           u.name AS creator_name,
           EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $2) AS joined
    FROM groups g
    LEFT JOIN users u ON u.id = g.created_by
    WHERE (g.id::text = $1 OR g.slug = $1)
    LIMIT 1`,

  byId: () => `SELECT id, name, slug, member_count FROM groups WHERE id = $1 LIMIT 1`,

  insert: () => `
    INSERT INTO groups (name, slug, description, segment, city, cover_path, is_premium, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, name, slug, description, segment, city, cover_path, is_premium, member_count, created_at`,

  isMember: () => `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,

  addMember: () => `
    INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)
    ON CONFLICT (group_id, user_id) DO NOTHING
    RETURNING group_id`,

  removeMember: () => `
    DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING group_id`,

  bumpMemberCount: () => `UPDATE groups SET member_count = member_count + $2 WHERE id = $1`,

  members: () => `
    SELECT u.id, u.name, u.handle, p.avatar_path, p.role_title, gm.role, gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE gm.group_id = $1
    ORDER BY gm.joined_at ASC
    LIMIT $2 OFFSET $3`,

  canCreate: () => `SELECT role, professional FROM users WHERE id = $1`,
};
