-- ============================================================================
-- 014 — Cada usuário tem uma PASTA-RAIZ de mídia reservada `{handle}-{YYYY-MM-DD}`
--   (criada no cadastro, no Storage e no Stream). `media_root` guarda o nome dessa
--   pasta; `stream_collection_id` guarda o id da coleção do usuário na Bunny Stream.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS media_root           text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_collection_id text;

-- Backfill dos usuários existentes (as pastas físicas materializam no 1º upload).
UPDATE users
SET media_root = lower(regexp_replace(handle, '[^a-zA-Z0-9._-]', '', 'g')) || '-' || to_char(created_at, 'YYYY-MM-DD')
WHERE media_root IS NULL;
