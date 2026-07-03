-- ============================================================================
-- 005 — @handle único por usuário (identificador público na plataforma).
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS handle text;

-- Backfill: deriva do local-part do e-mail; sufixo numérico em colisão.
WITH base AS (
  SELECT id,
         regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g') AS h,
         row_number() OVER (
           PARTITION BY regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g')
           ORDER BY created_at, id
         ) AS rn
  FROM users
  WHERE handle IS NULL OR handle = ''
)
UPDATE users u
SET handle = CASE WHEN b.rn = 1 THEN b.h ELSE b.h || b.rn::text END
FROM base b
WHERE u.id = b.id;

-- Fallback p/ local-part vazio.
UPDATE users SET handle = 'user' || left(id::text, 6) WHERE handle IS NULL OR handle = '';

-- Único case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS users_handle_lower_unique ON users (lower(handle));
ALTER TABLE users ALTER COLUMN handle SET NOT NULL;
