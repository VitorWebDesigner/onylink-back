-- ============================================================================
-- 006 — Candidaturas em oportunidades: formulário do dono + candidaturas.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Formulário que o DONO define ao criar a oportunidade (lista de perguntas).
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS application_form jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS opportunity_applications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  applicant_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ label, answer }]
  status         application_status NOT NULL DEFAULT 'PENDING',
  owner_reply    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, applicant_id)
);
CREATE INDEX IF NOT EXISTS idx_opp_apps ON opportunity_applications(opportunity_id, created_at DESC);
