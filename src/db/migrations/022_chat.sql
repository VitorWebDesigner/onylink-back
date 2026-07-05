-- 022: FASE B (plano-grupos-comunidades.md) — chat real na aba Mensagens.
-- `conversations` (001, só 1:1 user_a/user_b) vira HÍBRIDA: 1:1 OU grupo de
-- chat estilo WhatsApp (máx 150 — gate no service). Membros/papéis/última
-- leitura em `conversation_members` (unread por last_read_at, igual group_reads).

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_group     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name         text,
  ADD COLUMN IF NOT EXISTS description  text,
  ADD COLUMN IF NOT EXISTS photo_path   text,   -- URL COMPLETA da CDN (padrão avatar/cover)
  ADD COLUMN IF NOT EXISTS created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0;

-- grupo não tem par user_a/user_b (CHECK user_a < user_b passa com NULL)
ALTER TABLE conversations ALTER COLUMN user_a DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN user_b DROP NOT NULL;

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'MEMBER',            -- ADMIN | MEMBER
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members (user_id);

-- backfill de 1:1 pré-existentes (módulo nunca foi ligado; idempotente)
INSERT INTO conversation_members (conversation_id, user_id)
  SELECT id, user_a FROM conversations WHERE user_a IS NOT NULL
  ON CONFLICT DO NOTHING;
INSERT INTO conversation_members (conversation_id, user_id)
  SELECT id, user_b FROM conversations WHERE user_b IS NOT NULL
  ON CONFLICT DO NOTHING;
UPDATE conversations c
  SET member_count = (SELECT count(*) FROM conversation_members cm WHERE cm.conversation_id = c.id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_desc ON messages (conversation_id, created_at DESC);
