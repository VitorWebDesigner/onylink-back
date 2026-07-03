// Comentário "muito reagido" (top-level, >= 2 reações) trazido inline no feed/busca
// (item 6) — o mais reagido por post, via LATERAL. NULL quando nenhum atinge o limiar.
// `viewer` = placeholder de parâmetro (ex. '$1') p/ trazer o estado do leitor
// (curtiu/insight/repost/share) e a barra inline funcionar; null = só contadores
// (usado no polling `liveCounts`, cujo $1 é o array de ids).
const topCommentLateral = (viewer: string | null) => `
    LEFT JOIN LATERAL (
      SELECT c.id, c.content, c.like_count, c.insight_count, c.repost_count, c.share_count,
             cu.id AS author_id, cu.name AS author_name${viewer ? `,
             EXISTS (SELECT 1 FROM comment_likes cl    WHERE cl.comment_id = c.id AND cl.user_id = ${viewer}) AS liked,
             EXISTS (SELECT 1 FROM comment_insights ci WHERE ci.comment_id = c.id AND ci.user_id = ${viewer}) AS insighted,
             EXISTS (SELECT 1 FROM comment_reposts cr  WHERE cr.comment_id = c.id AND cr.user_id = ${viewer}) AS reposted,
             EXISTS (SELECT 1 FROM comment_shares cs   WHERE cs.comment_id = c.id AND cs.user_id = ${viewer}) AS shared` : ''}
      FROM comments c JOIN users cu ON cu.id = c.author_id
      WHERE c.post_id = p.id AND c.parent_id IS NULL
        AND (c.like_count + c.insight_count + c.repost_count + c.share_count) >= 2
      ORDER BY (c.like_count + c.insight_count + c.repost_count + c.share_count) DESC, c.created_at ASC
      LIMIT 1
    ) tc ON true`;

// Mídia do post (imagens/vídeo) agregada como json, ordenada por posição.
const MEDIA_JSON = `
           COALESCE((SELECT json_agg(json_build_object('type', pm.type, 'path', pm.path) ORDER BY pm.position)
                     FROM post_media pm WHERE pm.post_id = p.id), '[]'::json) AS media`;

// Colunas do comentário-destaque expostas no SELECT do feed/busca (com estado do leitor).
const TOP_COMMENT_COLS = `
           tc.id AS top_comment_id, tc.content AS top_comment_content,
           tc.author_id AS top_comment_author_id,
           tc.author_name AS top_comment_author, tc.like_count AS top_comment_like_count,
           tc.insight_count AS top_comment_insight_count, tc.repost_count AS top_comment_repost_count,
           tc.share_count AS top_comment_share_count, tc.liked AS top_comment_liked,
           tc.insighted AS top_comment_insighted, tc.reposted AS top_comment_reposted,
           tc.shared AS top_comment_shared`;

/** SQL do módulo posts/feed (inclui comentários, reações e salvos). */
export const postsModel = {
  insertPost: () => `
    INSERT INTO posts (author_id, group_id, category, content, status)
    VALUES ($1, $2, $3, $4, 'APPROVED')
    RETURNING id, author_id, group_id, category, content, status, created_at`,

  insertMedia: () => `
    INSERT INTO post_media (post_id, type, path, position)
    VALUES ($1, $2, $3, $4)`,

  getById: () => `
    SELECT p.*, u.name AS author_name, pr.avatar_path AS author_avatar
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN profiles pr ON pr.user_id = p.author_id
    WHERE p.id = $1`,

  updatePost: () => `
    UPDATE posts SET content = COALESCE($2, content), category = COALESCE($3, category)
    WHERE id = $1 AND author_id = $4
    RETURNING id`,

  deletePost: () => `DELETE FROM posts WHERE id = $1 AND author_id = $2 RETURNING id`,

  /**
   * Feed: só posts APPROVED e não limitados, ordenado por utilidade + recência.
   * Prioriza conexões/segmento/cidade via utility_score já materializado (CLAUDE §8).
   * Filtros opcionais por categoria/grupo. Paginação por OFFSET (cursor).
   */
  feed: () => `
    SELECT p.id, p.author_id, p.category, p.content, p.like_count, p.comment_count,
           p.repost_count, p.share_count, p.insight_count, p.view_count, p.created_at,
           u.name AS author_name, pr.avatar_path AS author_avatar,
           EXISTS (SELECT 1 FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS liked,
           EXISTS (SELECT 1 FROM saved_posts s WHERE s.post_id = p.id AND s.user_id = $1) AS saved,
           EXISTS (SELECT 1 FROM post_reposts rp WHERE rp.post_id = p.id AND rp.user_id = $1) AS reposted,
           EXISTS (SELECT 1 FROM post_shares sh WHERE sh.post_id = p.id AND sh.user_id = $1) AS shared,
           EXISTS (SELECT 1 FROM post_insights pi WHERE pi.post_id = p.id AND pi.user_id = $1) AS insighted,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = p.author_id) AS author_followed,
           EXISTS (SELECT 1 FROM post_subscriptions ps WHERE ps.post_id = p.id AND ps.user_id = $1) AS subscribed,
           ${MEDIA_JSON},${TOP_COMMENT_COLS}
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN profiles pr ON pr.user_id = p.author_id
    ${topCommentLateral('$1')}
    WHERE p.status = 'APPROVED'
      AND ($2::post_category IS NULL OR p.category = $2)
      AND ($3::uuid IS NULL OR p.group_id = $3)
    ORDER BY (p.utility_score
              + CASE WHEN p.author_id IN (
                  SELECT followee_id FROM follows WHERE follower_id = $1
                ) THEN 50 ELSE 0 END) DESC,
             p.created_at DESC
    LIMIT $4 OFFSET $5`,

  // Busca de posts por conteúdo ($2). $1=viewerId, $3=limit, $4=offset. Mesma
  // forma do feed (reaproveita o PostCard no front).
  searchPosts: () => `
    SELECT p.id, p.author_id, p.category, p.content, p.like_count, p.comment_count,
           p.repost_count, p.share_count, p.insight_count, p.view_count, p.created_at,
           u.name AS author_name, pr.avatar_path AS author_avatar,
           EXISTS (SELECT 1 FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS liked,
           EXISTS (SELECT 1 FROM saved_posts s WHERE s.post_id = p.id AND s.user_id = $1) AS saved,
           EXISTS (SELECT 1 FROM post_reposts rp WHERE rp.post_id = p.id AND rp.user_id = $1) AS reposted,
           EXISTS (SELECT 1 FROM post_shares sh WHERE sh.post_id = p.id AND sh.user_id = $1) AS shared,
           EXISTS (SELECT 1 FROM post_insights pi WHERE pi.post_id = p.id AND pi.user_id = $1) AS insighted,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = p.author_id) AS author_followed,
           EXISTS (SELECT 1 FROM post_subscriptions ps WHERE ps.post_id = p.id AND ps.user_id = $1) AS subscribed,
           ${MEDIA_JSON},${TOP_COMMENT_COLS}
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN profiles pr ON pr.user_id = p.author_id
    ${topCommentLateral('$1')}
    WHERE p.status = 'APPROVED' AND p.content ILIKE '%' || $2 || '%'
    ORDER BY p.created_at DESC
    LIMIT $3 OFFSET $4`,

  // Posts de um autor (perfil, aba Publicações). Mesma forma do feed (reaproveita o
  // PostCard no front). Post FIXADO vem primeiro. $1=viewerId, $2=authorId, $3=limit, $4=offset.
  byAuthor: () => `
    SELECT p.id, p.author_id, p.category, p.content, p.like_count, p.comment_count,
           p.repost_count, p.share_count, p.insight_count, p.view_count, p.created_at,
           (p.pinned_at IS NOT NULL) AS pinned,
           u.name AS author_name, pr.avatar_path AS author_avatar,
           EXISTS (SELECT 1 FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS liked,
           EXISTS (SELECT 1 FROM saved_posts s WHERE s.post_id = p.id AND s.user_id = $1) AS saved,
           EXISTS (SELECT 1 FROM post_reposts rp WHERE rp.post_id = p.id AND rp.user_id = $1) AS reposted,
           EXISTS (SELECT 1 FROM post_shares sh WHERE sh.post_id = p.id AND sh.user_id = $1) AS shared,
           EXISTS (SELECT 1 FROM post_insights pi WHERE pi.post_id = p.id AND pi.user_id = $1) AS insighted,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = p.author_id) AS author_followed,
           EXISTS (SELECT 1 FROM post_subscriptions ps WHERE ps.post_id = p.id AND ps.user_id = $1) AS subscribed,
           ${MEDIA_JSON},${TOP_COMMENT_COLS}
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN profiles pr ON pr.user_id = p.author_id
    ${topCommentLateral('$1')}
    WHERE p.status = 'APPROVED' AND p.author_id = $2
    ORDER BY (p.pinned_at IS NOT NULL) DESC, p.created_at DESC
    LIMIT $3 OFFSET $4`,

  // Posts REPOSTADOS por um usuário (aba Reposts do perfil), na ordem do repost.
  // $1=viewerId, $2=userId, $3=limit, $4=offset.
  repostedBy: () => `
    SELECT p.id, p.author_id, p.category, p.content, p.like_count, p.comment_count,
           p.repost_count, p.share_count, p.insight_count, p.view_count, p.created_at,
           u.name AS author_name, pr.avatar_path AS author_avatar,
           EXISTS (SELECT 1 FROM reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS liked,
           EXISTS (SELECT 1 FROM saved_posts s WHERE s.post_id = p.id AND s.user_id = $1) AS saved,
           EXISTS (SELECT 1 FROM post_reposts rp2 WHERE rp2.post_id = p.id AND rp2.user_id = $1) AS reposted,
           EXISTS (SELECT 1 FROM post_shares sh WHERE sh.post_id = p.id AND sh.user_id = $1) AS shared,
           EXISTS (SELECT 1 FROM post_insights pi WHERE pi.post_id = p.id AND pi.user_id = $1) AS insighted,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = p.author_id) AS author_followed,
           EXISTS (SELECT 1 FROM post_subscriptions ps WHERE ps.post_id = p.id AND ps.user_id = $1) AS subscribed,
           ${MEDIA_JSON},${TOP_COMMENT_COLS}
    FROM post_reposts reps
    JOIN posts p ON p.id = reps.post_id
    JOIN users u ON u.id = p.author_id
    LEFT JOIN profiles pr ON pr.user_id = p.author_id
    ${topCommentLateral('$1')}
    WHERE reps.user_id = $2 AND p.status = 'APPROVED'
    ORDER BY reps.created_at DESC
    LIMIT $3 OFFSET $4`,

  /* post fixado no perfil (1 por usuário: fixar limpa o anterior) */
  pinPost: () => `
    WITH cleared AS (UPDATE posts SET pinned_at = NULL WHERE author_id = $2 AND pinned_at IS NOT NULL)
    UPDATE posts SET pinned_at = now() WHERE id = $1 AND author_id = $2 RETURNING id`,
  unpinPost: () => `UPDATE posts SET pinned_at = NULL WHERE id = $1 AND author_id = $2 RETURNING id`,

  // Contadores "ao vivo" de um conjunto de posts ($1 = uuid[]) — usado pelo polling
  // do feed pra refletir reações de OUTROS usuários em tempo quase real (item 2).
  // Leve: só contadores + comentário em destaque, sem estado do leitor.
  liveCounts: () => `
    SELECT p.id, p.like_count, p.comment_count, p.repost_count, p.share_count, p.insight_count, p.view_count,
           tc.id AS top_comment_id, tc.content AS top_comment_content,
           tc.author_name AS top_comment_author, tc.like_count AS top_comment_like_count,
           tc.insight_count AS top_comment_insight_count, tc.repost_count AS top_comment_repost_count,
           tc.share_count AS top_comment_share_count
    FROM posts p
    ${topCommentLateral(null)}
    WHERE p.id = ANY($1::uuid[])`,

  mediaForPost: () => `SELECT type, path, position FROM post_media WHERE post_id = $1 ORDER BY position`,

  /* reações */
  like: () => `
    INSERT INTO reactions (post_id, user_id, kind) VALUES ($1, $2, 'LIKE')
    ON CONFLICT DO NOTHING RETURNING post_id`,
  unlike: () => `DELETE FROM reactions WHERE post_id = $1 AND user_id = $2 AND kind = 'LIKE' RETURNING post_id`,
  bumpLike: () => `UPDATE posts SET like_count = like_count + $2 WHERE id = $1`,

  /* reposts */
  repost: () => `INSERT INTO post_reposts (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING post_id`,
  unrepost: () => `DELETE FROM post_reposts WHERE post_id = $1 AND user_id = $2 RETURNING post_id`,
  bumpRepost: () => `UPDATE posts SET repost_count = repost_count + $2 WHERE id = $1`,

  /* envios (share) */
  share: () => `INSERT INTO post_shares (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING post_id`,
  unshare: () => `DELETE FROM post_shares WHERE post_id = $1 AND user_id = $2 RETURNING post_id`,
  bumpShare: () => `UPDATE posts SET share_count = share_count + $2 WHERE id = $1`,

  /* insight (reação de valor) */
  insight: () => `INSERT INTO post_insights (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING post_id`,
  uninsight: () => `DELETE FROM post_insights WHERE post_id = $1 AND user_id = $2 RETURNING post_id`,
  bumpInsight: () => `UPDATE posts SET insight_count = insight_count + $2 WHERE id = $1`,

  /* views (1 por usuário) */
  recordView: () => `INSERT INTO post_views (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING post_id`,
  bumpView: () => `UPDATE posts SET view_count = view_count + $2 WHERE id = $1`,
  getViewCount: () => `SELECT view_count FROM posts WHERE id = $1`,

  /* inscrição de notificação do post */
  subscribe: () => `INSERT INTO post_subscriptions (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
  unsubscribe: () => `DELETE FROM post_subscriptions WHERE post_id = $1 AND user_id = $2`,

  /* salvos */
  save: () => `INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
  unsave: () => `DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2`,
  listSaved: () => `
    SELECT p.id, p.category, p.content, p.created_at, u.name AS author_name
    FROM saved_posts s JOIN posts p ON p.id = s.post_id JOIN users u ON u.id = p.author_id
    WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`,

  /* comentários (com threading + reações — item 4) */
  insertComment: () => `
    INSERT INTO comments (post_id, author_id, content, parent_id) VALUES ($1, $2, $3, $4)
    RETURNING id, post_id, author_id, content, parent_id, created_at`,
  bumpComment: () => `UPDATE posts SET comment_count = comment_count + $2 WHERE id = $1`,
  bumpReply: () => `UPDATE comments SET reply_count = reply_count + $2 WHERE id = $1`,
  // Lista TODOS (topo + respostas) chapado, com estado de reação do leitor ($2);
  // o front aninha por parent_id. $1=postId, $2=viewerId, $3=limit, $4=offset.
  listComments: () => `
    SELECT c.id, c.content, c.created_at, c.author_id, c.parent_id,
           c.like_count, c.insight_count, c.reply_count, c.repost_count, c.share_count,
           u.name AS author_name, pr.avatar_path AS author_avatar,
           EXISTS (SELECT 1 FROM comment_likes cl    WHERE cl.comment_id = c.id AND cl.user_id = $2) AS liked,
           EXISTS (SELECT 1 FROM comment_insights ci WHERE ci.comment_id = c.id AND ci.user_id = $2) AS insighted,
           EXISTS (SELECT 1 FROM comment_reposts cr  WHERE cr.comment_id = c.id AND cr.user_id = $2) AS reposted,
           EXISTS (SELECT 1 FROM comment_shares cs   WHERE cs.comment_id = c.id AND cs.user_id = $2) AS shared
    FROM comments c JOIN users u ON u.id = c.author_id
    LEFT JOIN profiles pr ON pr.user_id = c.author_id
    WHERE c.post_id = $1 ORDER BY c.created_at ASC LIMIT $3 OFFSET $4`,
  deleteComment: () => `DELETE FROM comments WHERE id = $1 AND author_id = $2 RETURNING post_id, parent_id`,

  /* reações de comentário — curtir · insight · repost · enviar (comentário = mini-post) */
  likeComment: () => `INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`,
  unlikeComment: () => `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
  bumpCommentLike: () => `UPDATE comments SET like_count = like_count + $2 WHERE id = $1`,
  insightComment: () => `INSERT INTO comment_insights (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`,
  uninsightComment: () => `DELETE FROM comment_insights WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
  bumpCommentInsight: () => `UPDATE comments SET insight_count = insight_count + $2 WHERE id = $1`,
  repostComment: () => `INSERT INTO comment_reposts (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`,
  unrepostComment: () => `DELETE FROM comment_reposts WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
  bumpCommentRepost: () => `UPDATE comments SET repost_count = repost_count + $2 WHERE id = $1`,
  shareComment: () => `INSERT INTO comment_shares (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`,
  unshareComment: () => `DELETE FROM comment_shares WHERE comment_id = $1 AND user_id = $2 RETURNING comment_id`,
  bumpCommentShare: () => `UPDATE comments SET share_count = share_count + $2 WHERE id = $1`,
};
