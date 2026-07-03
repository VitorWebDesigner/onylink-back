-- ============================================================================
-- 004 — Post imediato (sem moderação) + reposts/envios com contadores.
-- ============================================================================

-- Posts agora são publicados na hora (como Instagram/X/Threads). Aprova os que
-- ficaram PENDING (criados sob a moderação antiga, que não tinha worker).
UPDATE posts SET status = 'APPROVED' WHERE status = 'PENDING';

-- Contadores materializados de repost/envio na própria linha do post.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_count int NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_count  int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS post_reposts (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_shares (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
