/** SQL do módulo opportunities. */
export const opportunitiesModel = {
  // Oportunidades não passam por moderação IA (pedidos de negócio, baixo risco) →
  // entram já APPROVED pra aparecer na listagem. (Posts continuam com moderação.)
  insert: () => `
    INSERT INTO opportunities (author_id, kind, title, description, city, segment, status, application_form)
    VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', $7)
    RETURNING id, kind, title, description, city, segment, status, application_form, created_at`,

  // Lista APROVADAS com filtros opcionais (NULL = ignora). $6 = id do usuário logado
  // (ou uuid nil) para calcular `liked`. Inclui contadores de curtida/comentário.
  list: () => `
    SELECT o.id, o.author_id, o.kind, o.title, o.description, o.city, o.segment, o.created_at,
           u.name AS author_name,
           (SELECT count(*) FROM opportunity_likes l WHERE l.opportunity_id = o.id)::int AS like_count,
           (SELECT count(*) FROM opportunity_comments c WHERE c.opportunity_id = o.id)::int AS comment_count,
           (SELECT count(*) FROM opportunity_insights ins WHERE ins.opportunity_id = o.id)::int AS insight_count,
           EXISTS (SELECT 1 FROM opportunity_likes l WHERE l.opportunity_id = o.id AND l.user_id = $6) AS liked,
           EXISTS (SELECT 1 FROM opportunity_insights ins WHERE ins.opportunity_id = o.id AND ins.user_id = $6) AS insighted
    FROM opportunities o
    JOIN users u ON u.id = o.author_id
    WHERE o.status = 'APPROVED'
      AND ($1::opportunity_kind IS NULL OR o.kind = $1)
      AND ($2::text IS NULL OR o.city ILIKE $2)
      AND ($3::text IS NULL OR o.segment ILIKE $3)
    ORDER BY o.created_at DESC
    LIMIT $4 OFFSET $5`,

  // Oportunidades de um autor (aba do perfil). $1=authorId, $2=viewerId, $3=limit, $4=offset.
  byAuthor: () => `
    SELECT o.id, o.author_id, o.kind, o.title, o.description, o.city, o.segment, o.created_at,
           u.name AS author_name,
           (SELECT count(*) FROM opportunity_likes l WHERE l.opportunity_id = o.id)::int AS like_count,
           (SELECT count(*) FROM opportunity_comments c WHERE c.opportunity_id = o.id)::int AS comment_count,
           (SELECT count(*) FROM opportunity_insights ins WHERE ins.opportunity_id = o.id)::int AS insight_count,
           EXISTS (SELECT 1 FROM opportunity_likes l WHERE l.opportunity_id = o.id AND l.user_id = $2) AS liked,
           EXISTS (SELECT 1 FROM opportunity_insights ins WHERE ins.opportunity_id = o.id AND ins.user_id = $2) AS insighted
    FROM opportunities o
    JOIN users u ON u.id = o.author_id
    WHERE o.status = 'APPROVED' AND o.author_id = $1
    ORDER BY o.created_at DESC
    LIMIT $3 OFFSET $4`,

  byId: () => `
    SELECT o.id, o.author_id, o.kind, o.title, o.description, o.city, o.segment, o.status, o.created_at,
           o.application_form, o.view_count,
           u.name AS author_name,
           (SELECT count(*) FROM opportunity_likes l WHERE l.opportunity_id = o.id)::int AS like_count,
           (SELECT count(*) FROM opportunity_comments c WHERE c.opportunity_id = o.id)::int AS comment_count,
           (SELECT count(*) FROM opportunity_applications a WHERE a.opportunity_id = o.id)::int AS application_count,
           (SELECT count(*) FROM opportunity_insights ins WHERE ins.opportunity_id = o.id)::int AS insight_count,
           EXISTS (SELECT 1 FROM opportunity_likes l WHERE l.opportunity_id = o.id AND l.user_id = $2) AS liked,
           EXISTS (SELECT 1 FROM opportunity_insights ins WHERE ins.opportunity_id = o.id AND ins.user_id = $2) AS insighted,
           EXISTS (SELECT 1 FROM opportunity_applications a WHERE a.opportunity_id = o.id AND a.applicant_id = $2) AS applied,
           EXISTS (SELECT 1 FROM opportunity_subscriptions s WHERE s.opportunity_id = o.id AND s.user_id = $2) AS subscribed,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followee_id = o.author_id) AS author_followed
    FROM opportunities o
    JOIN users u ON u.id = o.author_id
    WHERE o.id = $1
    LIMIT 1`,

  delete: () => `DELETE FROM opportunities WHERE id = $1 AND author_id = $2 RETURNING id`,

  authorOf: () => `SELECT author_id FROM opportunities WHERE id = $1 LIMIT 1`,

  // Oportunidades do dono (com nº de candidaturas). Mesmo shape do list + application_count.
  mine: () => `
    SELECT o.id, o.kind, o.title, o.description, o.city, o.segment, o.created_at,
           u.name AS author_name,
           (SELECT count(*) FROM opportunity_applications a WHERE a.opportunity_id = o.id)::int AS application_count,
           (SELECT count(*) FROM opportunity_likes l WHERE l.opportunity_id = o.id)::int AS like_count,
           (SELECT count(*) FROM opportunity_comments c WHERE c.opportunity_id = o.id)::int AS comment_count,
           false AS liked
    FROM opportunities o
    JOIN users u ON u.id = o.author_id
    WHERE o.author_id = $1
    ORDER BY o.created_at DESC
    LIMIT $2 OFFSET $3`,

  // ───────── candidaturas ─────────
  apply: () => `
    INSERT INTO opportunity_applications (opportunity_id, applicant_id, answers)
    VALUES ($1, $2, $3)
    ON CONFLICT (opportunity_id, applicant_id)
    DO UPDATE SET answers = EXCLUDED.answers, status = 'PENDING', created_at = now()
    RETURNING id`,

  listApplications: () => `
    SELECT a.id, a.answers, a.status, a.owner_reply, a.created_at, u.name AS applicant_name
    FROM opportunity_applications a
    JOIN users u ON u.id = a.applicant_id
    WHERE a.opportunity_id = $1
    ORDER BY a.created_at DESC
    LIMIT $2 OFFSET $3`,

  // Atualiza status/resposta — só se o requisitante for o dono da oportunidade.
  updateApplication: () => `
    UPDATE opportunity_applications a
    SET status = COALESCE($3::application_status, a.status),
        owner_reply = COALESCE($4, a.owner_reply)
    FROM opportunities o
    WHERE a.id = $1 AND o.id = a.opportunity_id AND o.author_id = $2
    RETURNING a.id, a.status, a.owner_reply`,

  // ───────── curtidas ─────────
  like: () => `
    INSERT INTO opportunity_likes (opportunity_id, user_id) VALUES ($1, $2)
    ON CONFLICT DO NOTHING RETURNING opportunity_id`,
  unlike: () => `DELETE FROM opportunity_likes WHERE opportunity_id = $1 AND user_id = $2`,

  // ───────── insight ─────────
  insight: () => `
    INSERT INTO opportunity_insights (opportunity_id, user_id) VALUES ($1, $2)
    ON CONFLICT DO NOTHING RETURNING opportunity_id`,
  uninsight: () => `DELETE FROM opportunity_insights WHERE opportunity_id = $1 AND user_id = $2`,

  // ───────── views + inscrição de notificação ─────────
  recordView: () => `INSERT INTO opportunity_views (opportunity_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING opportunity_id`,
  bumpView: () => `UPDATE opportunities SET view_count = view_count + $2 WHERE id = $1`,
  getViewCount: () => `SELECT view_count FROM opportunities WHERE id = $1`,
  subscribe: () => `INSERT INTO opportunity_subscriptions (opportunity_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
  unsubscribe: () => `DELETE FROM opportunity_subscriptions WHERE opportunity_id = $1 AND user_id = $2`,

  // ───────── comentários (threading + reações — item 4) ─────────
  // $1=oppId, $2=viewerId, $3=limit, $4=offset. Chapado; front aninha por parent_id.
  listComments: () => `
    SELECT c.id, c.content, c.created_at, c.author_id, c.parent_id,
           c.like_count, c.insight_count, c.reply_count, c.repost_count, c.share_count,
           u.name AS author_name, pr.avatar_path AS author_avatar,
           EXISTS (SELECT 1 FROM opp_comment_likes cl    WHERE cl.comment_id = c.id AND cl.user_id = $2) AS liked,
           EXISTS (SELECT 1 FROM opp_comment_insights ci WHERE ci.comment_id = c.id AND ci.user_id = $2) AS insighted,
           EXISTS (SELECT 1 FROM opp_comment_reposts cr  WHERE cr.comment_id = c.id AND cr.user_id = $2) AS reposted,
           EXISTS (SELECT 1 FROM opp_comment_shares cs   WHERE cs.comment_id = c.id AND cs.user_id = $2) AS shared
    FROM opportunity_comments c
    JOIN users u ON u.id = c.author_id
    LEFT JOIN profiles pr ON pr.user_id = c.author_id
    WHERE c.opportunity_id = $1
    ORDER BY c.created_at ASC
    LIMIT $3 OFFSET $4`,
  addComment: () => `
    INSERT INTO opportunity_comments (opportunity_id, author_id, content, parent_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, content, parent_id, created_at`,
  bumpReply: () => `UPDATE opportunity_comments SET reply_count = reply_count + $2 WHERE id = $1`,

  /* reações de comentário de oportunidade */
  likeComment: () => `INSERT INTO opp_comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`,
  unlikeComment: () => `DELETE FROM opp_comment_likes WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
  bumpCommentLike: () => `UPDATE opportunity_comments SET like_count = like_count + $2 WHERE id = $1`,
  insightComment: () => `INSERT INTO opp_comment_insights (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`,
  uninsightComment: () => `DELETE FROM opp_comment_insights WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
  bumpCommentInsight: () => `UPDATE opportunity_comments SET insight_count = insight_count + $2 WHERE id = $1`,
  repostComment: () => `INSERT INTO opp_comment_reposts (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`,
  unrepostComment: () => `DELETE FROM opp_comment_reposts WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
  bumpCommentRepost: () => `UPDATE opportunity_comments SET repost_count = repost_count + $2 WHERE id = $1`,
  shareComment: () => `INSERT INTO opp_comment_shares (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`,
  unshareComment: () => `DELETE FROM opp_comment_shares WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
  bumpCommentShare: () => `UPDATE opportunity_comments SET share_count = share_count + $2 WHERE id = $1`,
};
