-- ============================================================================
-- 007 — Ação "Insight" (reação de valor empresarial) em posts e oportunidades.
-- ============================================================================

ALTER TABLE posts         ADD COLUMN IF NOT EXISTS insight_count int NOT NULL DEFAULT 0;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS insight_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS post_insights (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS opportunity_insights (
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, user_id)
);
