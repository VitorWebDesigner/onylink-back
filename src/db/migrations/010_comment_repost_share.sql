-- ============================================================================
-- 010 — Comentário é mini-post COMPLETO: além de curtir/insight, ganha REPOST e
--        SHARE (enviar), em posts E oportunidades. Assim o comentário tem a mesma
--        barra de ações do post (insight · curtir · comentar · repost · enviar).
-- ============================================================================

-- ───────────────── comentários de POST ─────────────────
ALTER TABLE comments ADD COLUMN IF NOT EXISTS repost_count int NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS share_count  int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS comment_reposts (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE IF NOT EXISTS comment_shares (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- ───────────────── comentários de OPORTUNIDADE ─────────────────
ALTER TABLE opportunity_comments ADD COLUMN IF NOT EXISTS repost_count int NOT NULL DEFAULT 0;
ALTER TABLE opportunity_comments ADD COLUMN IF NOT EXISTS share_count  int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS opp_comment_reposts (
  comment_id uuid NOT NULL REFERENCES opportunity_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE IF NOT EXISTS opp_comment_shares (
  comment_id uuid NOT NULL REFERENCES opportunity_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- alguns reposts/shares no seed pra ver contadores preenchidos
INSERT INTO comment_reposts (comment_id, user_id) VALUES
  ('cccc0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('cccc0003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444')
ON CONFLICT DO NOTHING;
INSERT INTO comment_shares (comment_id, user_id) VALUES
  ('cccc0001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333')
ON CONFLICT DO NOTHING;

UPDATE comments c SET
  repost_count = (SELECT count(*) FROM comment_reposts cr WHERE cr.comment_id = c.id),
  share_count  = (SELECT count(*) FROM comment_shares  cs WHERE cs.comment_id = c.id)
WHERE c.post_id::text LIKE 'aaaa%';
