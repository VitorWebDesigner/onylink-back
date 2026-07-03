-- ============================================================================
-- 003 — Engajamento de oportunidades: curtidas + comentários.
-- Idempotente (IF NOT EXISTS). Ver módulo opportunities.
-- ============================================================================

CREATE TABLE IF NOT EXISTS opportunity_likes (
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, user_id)
);

CREATE TABLE IF NOT EXISTS opportunity_comments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  author_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content        text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opp_comments ON opportunity_comments(opportunity_id, created_at);
