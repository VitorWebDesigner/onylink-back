/** SQL do módulo moderation. */
export const moderationModel = {
  insertReport: () => `
    INSERT INTO reports (reporter_id, target_type, target_id, reason)
    VALUES ($1, $2, $3, $4)
    RETURNING id, target_type, target_id, reason, status, created_at`,

  listReports: () => `
    SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
           u.name AS reporter_name
    FROM reports r
    LEFT JOIN users u ON u.id = r.reporter_id
    WHERE ($1::report_status IS NULL OR r.status = $1)
    ORDER BY r.created_at DESC
    LIMIT $2 OFFSET $3`,

  setReportStatus: () => `
    UPDATE reports SET status = $2 WHERE id = $1
    RETURNING id, target_type, target_id, status`,

  insertLog: () => `
    INSERT INTO moderation_logs (moderator_id, target_type, target_id, action, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id`,

  /* posts (decisão de moderação) */
  getPost: () => `SELECT id, author_id, content, status FROM posts WHERE id = $1 LIMIT 1`,

  setPostStatus: () => `
    UPDATE posts
    SET status = $2, moderation_reason = $3, moderation_score = $4
    WHERE id = $1
    RETURNING id, status`,
};
