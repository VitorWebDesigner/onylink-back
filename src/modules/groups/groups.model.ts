/** SQL do módulo groups. Funções puras → string parametrizada ($1,$2...). */
export const groupsModel = {
  list: () => `
    SELECT id, name, slug, description, segment, city, cover_path, is_premium, member_count, created_at
    FROM groups
    WHERE ($1::text IS NULL OR segment = $1)
      AND ($2::text IS NULL OR city = $2)
    ORDER BY member_count DESC, created_at DESC
    LIMIT $3 OFFSET $4`,

  bySlug: () => `
    SELECT id, name, slug, description, segment, city, cover_path, is_premium, member_count, created_by, created_at
    FROM groups WHERE slug = $1 LIMIT 1`,

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
    SELECT u.id, u.name, p.avatar_path, p.role_title, gm.role, gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE gm.group_id = $1
    ORDER BY gm.joined_at ASC
    LIMIT $2 OFFSET $3`,
};
