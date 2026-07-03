export const usersModel = {
  // $1 = alvo, $2 = viewer (nil p/ guest) para calcular `followed`.
  publicProfile: () => `
    SELECT u.id, u.name, u.handle, u.role, u.created_at, u.verified, u.professional,
           p.avatar_path, p.cover_path, p.bio, p.role_title, p.segment, p.city, p.state,
           p.interests, p.links, p.points, p.profile_complete,
           p.contact_email, p.contact_whatsapp, p.contact_url,
           c.id AS company_id, c.name AS company_name, c.segment AS company_segment,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followee_id = u.id) AS followed,
           (SELECT count(*) FROM follows f WHERE f.followee_id = u.id)::int AS followers_count,
           (SELECT count(*) FROM follows f WHERE f.follower_id = u.id)::int AS following_count,
           (SELECT count(*) FROM posts po WHERE po.author_id = u.id AND po.status = 'APPROVED')::int AS posts_count
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN companies c ON c.id = p.company_id
    WHERE u.id = $1 AND u.active = true
    LIMIT 1`,

  // Garante a linha do perfil antes do UPDATE (usuários antigos podem não ter).
  ensureRow: () => `INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,

  updateName: () => `UPDATE users SET name = $2 WHERE id = $1`,

  // COALESCE mantém o valor atual quando o campo não veio no update.
  updateProfile: () => `
    UPDATE profiles SET
      avatar_path  = COALESCE($2, avatar_path),
      bio          = COALESCE($3, bio),
      role_title   = COALESCE($4, role_title),
      segment      = COALESCE($5, segment),
      city         = COALESCE($6, city),
      state        = COALESCE($7, state),
      interests    = COALESCE($8, interests),
      links        = COALESCE($9, links),
      main_goal    = COALESCE($10, main_goal),
      revenue_band = COALESCE($11, revenue_band),
      cover_path   = COALESCE($12, cover_path),
      contact_email    = COALESCE($13, contact_email),
      contact_whatsapp = COALESCE($14, contact_whatsapp),
      contact_url      = COALESCE($15, contact_url)
    WHERE user_id = $1
    RETURNING user_id, avatar_path, cover_path, bio, role_title, segment, city, state,
              interests, links, main_goal, revenue_band, contact_email, contact_whatsapp, contact_url`,

  // Perfil considerado completo quando os campos essenciais existem.
  recomputeComplete: () => `
    UPDATE profiles SET profile_complete = (
      bio IS NOT NULL AND role_title IS NOT NULL AND segment IS NOT NULL AND city IS NOT NULL
    ) WHERE user_id = $1 RETURNING profile_complete`,

  /**
   * Painel do Empresário (plano-perfil.md Fase 2). $1 = userId.
   * Janela atual = últimos 30 dias; anterior = 30–60 dias atrás (p/ variação).
   * Tudo "recebido" nos POSTS DO USUÁRIO (JOIN em posts.author_id).
   */
  insights: () => `
    WITH mine AS (SELECT id FROM posts WHERE author_id = $1)
    SELECT
      (SELECT count(*) FROM post_views v JOIN mine m ON m.id = v.post_id
        WHERE v.created_at >= now() - interval '30 days')::int                                   AS views_30d,
      (SELECT count(*) FROM post_views v JOIN mine m ON m.id = v.post_id
        WHERE v.created_at >= now() - interval '60 days'
          AND v.created_at <  now() - interval '30 days')::int                                   AS views_prev,
      (SELECT count(*) FROM post_insights i JOIN mine m ON m.id = i.post_id
        WHERE i.created_at >= now() - interval '30 days')::int                                   AS insights_30d,
      (SELECT count(*) FROM post_insights i JOIN mine m ON m.id = i.post_id
        WHERE i.created_at >= now() - interval '60 days'
          AND i.created_at <  now() - interval '30 days')::int                                   AS insights_prev,
      (SELECT count(*) FROM follows f WHERE f.followee_id = $1
        AND f.created_at >= now() - interval '30 days')::int                                     AS followers_30d,
      (SELECT count(*) FROM follows f WHERE f.followee_id = $1
        AND f.created_at >= now() - interval '60 days'
        AND f.created_at <  now() - interval '30 days')::int                                     AS followers_prev,
      (SELECT count(*) FROM follows f WHERE f.followee_id = $1)::int                             AS followers_total,
      ((SELECT count(*) FROM reactions r JOIN mine m ON m.id = r.post_id
         WHERE r.created_at >= now() - interval '30 days')
       + (SELECT count(*) FROM comments c JOIN mine m ON m.id = c.post_id
           WHERE c.author_id <> $1 AND c.created_at >= now() - interval '30 days')
       + (SELECT count(*) FROM post_reposts rp JOIN mine m ON m.id = rp.post_id
           WHERE rp.created_at >= now() - interval '30 days'))::int                              AS interactions_30d,
      ((SELECT count(*) FROM reactions r JOIN mine m ON m.id = r.post_id
         WHERE r.created_at >= now() - interval '60 days' AND r.created_at < now() - interval '30 days')
       + (SELECT count(*) FROM comments c JOIN mine m ON m.id = c.post_id
           WHERE c.author_id <> $1
             AND c.created_at >= now() - interval '60 days' AND c.created_at < now() - interval '30 days')
       + (SELECT count(*) FROM post_reposts rp JOIN mine m ON m.id = rp.post_id
           WHERE rp.created_at >= now() - interval '60 days' AND rp.created_at < now() - interval '30 days'))::int AS interactions_prev,
      (SELECT count(*) FROM opportunity_applications a
        JOIN opportunities o ON o.id = a.opportunity_id
        WHERE o.author_id = $1 AND a.created_at >= now() - interval '30 days')::int              AS applications_30d,
      (SELECT count(*) FROM opportunity_applications a
        JOIN opportunities o ON o.id = a.opportunity_id WHERE o.author_id = $1)::int             AS applications_total,
      (SELECT p.points FROM profiles p WHERE p.user_id = $1)                                     AS points`,

  // Top publicações do usuário (por alcance) + 1ª mídia p/ thumbnail. $1 = userId.
  topPosts: () => `
    SELECT p.id, p.content, p.category, p.view_count, p.insight_count, p.like_count, p.comment_count, p.created_at,
           fm.type AS media_type, fm.path AS media_path
    FROM posts p
    LEFT JOIN LATERAL (
      SELECT type, path FROM post_media pm WHERE pm.post_id = p.id ORDER BY pm.position LIMIT 1
    ) fm ON true
    WHERE p.author_id = $1 AND p.status = 'APPROVED'
    ORDER BY p.view_count DESC, p.insight_count DESC
    LIMIT 3`,

  // Comentários feitos pelo usuário (aba Respostas), com contexto do post.
  // $1=authorId, $2=limit, $3=offset.
  commentsByAuthor: () => `
    SELECT c.id, c.content, c.created_at, c.post_id, c.like_count, c.insight_count, c.reply_count,
           pu.name AS post_author_name, po.content AS post_content
    FROM comments c
    JOIN posts po ON po.id = c.post_id
    JOIN users pu ON pu.id = po.author_id
    WHERE c.author_id = $1
    ORDER BY c.created_at DESC
    LIMIT $2 OFFSET $3`,

  // Mídias dos posts do usuário (aba Mídia, grade). $1=authorId, $2=limit, $3=offset.
  mediaByAuthor: () => `
    SELECT pm.post_id, pm.type, pm.path, pm.position, po.created_at
    FROM post_media pm
    JOIN posts po ON po.id = pm.post_id
    WHERE po.author_id = $1 AND po.status = 'APPROVED'
    ORDER BY po.created_at DESC, pm.position ASC
    LIMIT $2 OFFSET $3`,

  // Listas de rede. $1=alvo, $2=viewer (followed = viewer já segue a pessoa listada).
  followers: () => `
    SELECT u.id, u.name, u.handle, p.avatar_path, p.role_title,
           EXISTS (SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.followee_id = u.id) AS followed
    FROM follows f
    JOIN users u ON u.id = f.follower_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE f.followee_id = $1 AND u.active = true
    ORDER BY f.created_at DESC
    LIMIT $3 OFFSET $4`,

  following: () => `
    SELECT u.id, u.name, u.handle, p.avatar_path, p.role_title,
           EXISTS (SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.followee_id = u.id) AS followed
    FROM follows f
    JOIN users u ON u.id = f.followee_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE f.follower_id = $1 AND u.active = true
    ORDER BY f.created_at DESC
    LIMIT $3 OFFSET $4`,

  isProfessional: () => `SELECT professional FROM users WHERE id = $1`,

  // Último diagnóstico do usuário (nota de maturidade). $1 = userId.
  latestDiagnostic: () => `
    SELECT score_financeiro, score_comercial, score_marketing, score_gestao, score_total, created_at
    FROM diagnostics
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 1`,

  // $1=termo, $2=limit, $3=offset, $4=viewerId (nil p/ guest). Busca por nome,
  // @handle, segmento ou cidade. `followed` = o viewer já segue.
  search: () => `
    SELECT u.id, u.name, u.handle, p.avatar_path, p.role_title, p.segment, p.city,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $4 AND f.followee_id = u.id) AS followed
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.active = true AND u.id <> $4
      AND (u.name ILIKE '%' || $1 || '%' OR u.handle ILIKE '%' || $1 || '%'
           OR p.segment ILIKE '%' || $1 || '%' OR p.city ILIKE '%' || $1 || '%')
    ORDER BY similarity(u.name, $1) DESC, p.points DESC NULLS LAST
    LIMIT $2 OFFSET $3`,
};
