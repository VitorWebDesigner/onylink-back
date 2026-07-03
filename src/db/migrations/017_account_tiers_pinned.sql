-- 017: tiers de conta (decisão do dono, plano-perfil.md §5) + post fixado (Fase 3).
--   * users.verified      → selo de verificação (exibido ao lado do nome).
--   * users.professional  → conta PROFISSIONAL: só ela vê o perfil metrificado
--     (Painel do Empresário e afins). Separa quem está engajado de quem usa
--     corriqueiramente. Por ora a flag é gerida por SQL/admin (painel futuro).
--   * posts.pinned_at     → post fixado no perfil (1 por usuário, o pin limpa os demais).

ALTER TABLE users ADD COLUMN IF NOT EXISTS verified     boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional boolean NOT NULL DEFAULT false;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_posts_author_pinned ON posts(author_id, pinned_at DESC NULLS LAST);

-- Contas existentes (dev/avaliação) permanecem com acesso completo; novas contas
-- nascem comuns e ganham os selos via gestão.
UPDATE users SET verified = true, professional = true;
