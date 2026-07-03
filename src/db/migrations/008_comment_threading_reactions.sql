-- ============================================================================
-- 008 — Comentários ganham THREADING (respostas) + AÇÕES (curtir/insight),
--        em posts E oportunidades. Comentário = "mini post": pode receber
--        resposta e reações, igual ao conteúdo pai. (CLAUDE.md §8 / item 4.)
-- ============================================================================

-- ───────────────── comentários de POST ─────────────────
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id    uuid REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS like_count   int NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS insight_count int NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS reply_count  int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id, created_at);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE IF NOT EXISTS comment_insights (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- ───────────────── comentários de OPORTUNIDADE ─────────────────
ALTER TABLE opportunity_comments ADD COLUMN IF NOT EXISTS parent_id     uuid REFERENCES opportunity_comments(id) ON DELETE CASCADE;
ALTER TABLE opportunity_comments ADD COLUMN IF NOT EXISTS like_count    int NOT NULL DEFAULT 0;
ALTER TABLE opportunity_comments ADD COLUMN IF NOT EXISTS insight_count int NOT NULL DEFAULT 0;
ALTER TABLE opportunity_comments ADD COLUMN IF NOT EXISTS reply_count   int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_opp_comments_parent ON opportunity_comments(parent_id, created_at);

CREATE TABLE IF NOT EXISTS opp_comment_likes (
  comment_id uuid NOT NULL REFERENCES opportunity_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE IF NOT EXISTS opp_comment_insights (
  comment_id uuid NOT NULL REFERENCES opportunity_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
