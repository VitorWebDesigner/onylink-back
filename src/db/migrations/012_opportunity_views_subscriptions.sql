-- ============================================================================
-- 012 — Oportunidade ganha views + inscrição de notificação (igual post), pra
--   o header do detalhe da oportunidade ser idêntico ao header do post.
-- ============================================================================

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS opportunity_views (
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, user_id)
);

CREATE TABLE IF NOT EXISTS opportunity_subscriptions (
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, user_id)
);

-- views de demonstração no seed
UPDATE opportunities SET view_count = v.n FROM (VALUES
  ('bbbb0001-0000-0000-0000-000000000001'::uuid, 87),
  ('bbbb0002-0000-0000-0000-000000000002'::uuid, 132),
  ('bbbb0003-0000-0000-0000-000000000003'::uuid, 64)
) AS v(id, n) WHERE opportunities.id = v.id;
