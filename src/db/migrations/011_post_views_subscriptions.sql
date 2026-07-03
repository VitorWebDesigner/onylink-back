-- ============================================================================
-- 011 — Views por post + inscrição de notificação por post.
--   * view_count materializado + post_views (1 view por usuário, dedupe).
--   * post_subscriptions: usuário "segue" um post p/ receber notificação dele.
-- ============================================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS post_views (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_subscriptions (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- views de demonstração nos posts do seed
UPDATE posts SET view_count = v.n FROM (VALUES
  ('aaaa0001-0000-0000-0000-000000000001'::uuid, 142),
  ('aaaa0002-0000-0000-0000-000000000002'::uuid, 98),
  ('aaaa0003-0000-0000-0000-000000000003'::uuid, 210),
  ('aaaa0004-0000-0000-0000-000000000004'::uuid, 76),
  ('aaaa0005-0000-0000-0000-000000000005'::uuid, 184),
  ('aaaa0006-0000-0000-0000-000000000006'::uuid, 53)
) AS v(id, n) WHERE posts.id = v.id;
