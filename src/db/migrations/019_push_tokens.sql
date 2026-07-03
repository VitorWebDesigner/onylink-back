-- 019 — Tokens de push (Expo Push Service). 1 linha por aparelho; o mesmo
-- usuário pode ter vários aparelhos. Token inválido (DeviceNotRegistered)
-- é removido pelo worker de push.

CREATE TABLE IF NOT EXISTS push_tokens (
  token      text PRIMARY KEY,                                     -- ExpoPushToken[...]
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   text,                                                 -- ios | android
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
