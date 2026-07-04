-- 021: última visita do usuário ao feed de cada comunidade.
-- Base do badge de "posts não vistos" (tab Mensagens → aba Comunidades → row).
-- Abrir o feed da comunidade faz UPSERT de last_seen_at = now().

CREATE TABLE IF NOT EXISTS group_reads (
  user_id      uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  group_id     uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

-- contagem de não vistos varre posts por grupo+data
CREATE INDEX IF NOT EXISTS idx_posts_group_created
  ON posts (group_id, created_at DESC) WHERE group_id IS NOT NULL;
