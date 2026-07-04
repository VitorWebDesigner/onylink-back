-- ============================================================================
-- 020 — Comunidades (plano-grupos-comunidades.md, decisões §5 — 04/07/2026).
--   * groups.is_private → privada exige APROVAÇÃO do admin (group_join_requests).
--   * Posts de comunidade só aparecem DENTRO dela; admin pode "repostar no
--     feed" → posts.featured_by/featured_at (feed geral inclui esses, com
--     créditos: quem repostou + autor + comunidade).
--   * user_pins: fixar comunidade/grupo de chat/conversa (máx. 5 por tipo —
--     gate no service; tabela genérica já serve a Fase B do chat).
--   * Criador da comunidade = ADMIN (backfill nos existentes).
--   * Limite de 200 membros por comunidade (gate no service).
-- ============================================================================

ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS group_join_requests (
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS featured_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS featured_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_posts_featured ON posts(featured_at) WHERE featured_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_pins (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('community', 'group', 'conversation')),
  target_id  uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, target_id)
);

-- criador vira ADMIN nas comunidades já existentes
UPDATE group_members gm
SET role = 'ADMIN'
FROM groups g
WHERE g.id = gm.group_id AND g.created_by = gm.user_id;
