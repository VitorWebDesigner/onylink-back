-- ============================================================================
-- 018 — Notificações (sino) sobre a tabela EXISTENTE (001: user_id, type,
-- payload jsonb). Índices de DEDUPE p/ reações e follow: o toggle
-- curtir/descurtir não spamma (INSERT ... ON CONFLICT DO NOTHING; o
-- "des-toggle" apaga a linha). payload: { actorId, postId?, commentId?,
-- opportunityId?, preview? }.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_reaction
  ON notifications (user_id, type, (payload->>'actorId'), (payload->>'postId'))
  WHERE type IN ('LIKE', 'INSIGHT', 'REPOST');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_follow
  ON notifications (user_id, type, (payload->>'actorId'))
  WHERE type = 'FOLLOW';
