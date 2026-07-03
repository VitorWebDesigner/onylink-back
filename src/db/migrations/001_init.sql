-- ============================================================================
-- OnyLink — schema inicial (MVP). Ver CLAUDE.md §4 e prompt.md §18.
-- SQL cru, sem ORM. Idempotente onde possível.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- busca por similaridade (nome/empresa)

-- ───────────────────────────── ENUMS ─────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role        AS ENUM ('USER', 'EXPERT', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE post_status      AS ENUM ('PENDING', 'APPROVED', 'NEEDS_REVIEW', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE post_category    AS ENUM ('Vendas','Marketing','Financeiro','Gestão','Liderança','Operação','Tecnologia','Contratação','Networking','Indicações','Cases','Oportunidades','Dúvidas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE media_type       AS ENUM ('IMAGE','VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM ('PENDING','ACCEPTED','BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE report_status    AS ENUM ('OPEN','REVIEWING','RESOLVED','DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE report_target    AS ENUM ('POST','COMMENT','USER','MESSAGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE moderation_action AS ENUM ('APPROVE','REMOVE','WARN','SUSPEND','BAN','LIMIT_REACH','BLOCK_MESSAGES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE opportunity_kind AS ENUM ('INDICACAO','PARCERIA','FORNECEDOR','VAGA','EVENTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('ACTIVE','PAST_DUE','CANCELED','TRIALING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────── trigger updated_at ─────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USERS / PROFILES / COMPANIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  segment         text,
  description     text,
  website         text,
  city            text,
  state           text,
  employees_band  text,                 -- ex. '1-10', '11-50'
  area            text,
  logo_path       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text NOT NULL UNIQUE,
  password_hash   text NOT NULL,         -- argon2id
  role            user_role NOT NULL DEFAULT 'USER',
  active          boolean NOT NULL DEFAULT true,
  email_verified  boolean NOT NULL DEFAULT false,
  suspended_until timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  avatar_path     text,
  bio             text,
  role_title      text,                  -- cargo
  segment         text,
  city            text,
  state           text,
  revenue_band    text,                  -- faturamento aproximado (opcional)
  interests       text[] DEFAULT '{}',
  links           jsonb  DEFAULT '[]',
  main_goal       text,                  -- vender mais, organizar financeiro, etc.
  points          integer NOT NULL DEFAULT 0,
  profile_complete boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_segment ON profiles(segment);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin (name gin_trgm_ops);

-- refresh tokens (sessões)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,            -- hash do refresh, nunca o token cru
  expires_at  timestamptz NOT NULL,
  revoked     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- ============================================================================
-- POSTS / FEED
-- ============================================================================
CREATE TABLE IF NOT EXISTS posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id        uuid,                  -- FK adicionada após groups
  category        post_category NOT NULL,
  content         text NOT NULL,
  status          post_status NOT NULL DEFAULT 'PENDING',
  moderation_score numeric(4,3),         -- 0..1 confiança da IA
  moderation_reason text,
  reach_limited   boolean NOT NULL DEFAULT false,
  like_count      integer NOT NULL DEFAULT 0,
  comment_count   integer NOT NULL DEFAULT 0,
  utility_score   numeric(6,2) NOT NULL DEFAULT 0,  -- usado na ordenação do feed
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_group ON posts(group_id);

CREATE TABLE IF NOT EXISTS post_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type        media_type NOT NULL,
  path        text NOT NULL,            -- caminho Bunny Storage (IMAGE) ou guid Stream (VIDEO)
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media(post_id);

CREATE TABLE IF NOT EXISTS comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS reactions (
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'LIKE',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, kind)
);

CREATE TABLE IF NOT EXISTS saved_posts (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ============================================================================
-- NETWORKING: follows + connections
-- ============================================================================
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE IF NOT EXISTS connections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       connection_status NOT NULL DEFAULT 'PENDING',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_connections_addressee ON connections(addressee_id, status);

-- ============================================================================
-- GROUPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  segment     text,
  city        text,
  cover_path  text,
  is_premium  boolean NOT NULL DEFAULT false,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  member_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id    uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'MEMBER',   -- MEMBER | MODERATOR
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- FK adiada de posts.group_id
DO $$ BEGIN
  ALTER TABLE posts ADD CONSTRAINT fk_posts_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- MESSAGES (1:1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)              -- normaliza par para evitar duplicata
);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

-- ============================================================================
-- DIAGNOSTICS (porta de entrada de aquisição)
-- ============================================================================
CREATE TABLE IF NOT EXISTS diagnostics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,   -- pode ser anônimo (lead) antes do cadastro
  lead_email  text,
  answers     jsonb NOT NULL,                                -- respostas brutas
  score_financeiro integer,
  score_comercial  integer,
  score_marketing  integer,
  score_gestao     integer,
  score_total      integer,
  recommendations  jsonb DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diagnostics_user ON diagnostics(user_id);

-- ============================================================================
-- MODERATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type report_target NOT NULL,
  target_id   uuid NOT NULL,
  reason      text NOT NULL,
  status      report_status NOT NULL DEFAULT 'OPEN',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid REFERENCES users(id) ON DELETE SET NULL,  -- null = IA
  target_type report_target NOT NULL,
  target_id   uuid NOT NULL,
  action      moderation_action NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,           -- LIKE | COMMENT | CONNECTION | MESSAGE | POST_APPROVED | POST_REJECTED
  payload     jsonb NOT NULL DEFAULT '{}',
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at DESC);

-- ============================================================================
-- GAMIFICATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,    -- PERFIL_COMPLETO, EMPRESARIO_VERIFICADO, CONECTOR, ...
  name        text NOT NULL,
  description text,
  icon        text
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS point_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      text NOT NULL,           -- POST_CREATED, COMMENT, PROFILE_COMPLETED, ...
  points      integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_point_events_user ON point_events(user_id);

-- ============================================================================
-- OPPORTUNITIES / EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS opportunities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        opportunity_kind NOT NULL,
  title       text NOT NULL,
  description text,
  city        text,
  segment     text,
  status      post_status NOT NULL DEFAULT 'PENDING',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opportunities_kind ON opportunities(kind, created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  city        text,
  is_online   boolean NOT NULL DEFAULT false,
  cover_path  text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- BILLING
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan        text NOT NULL,           -- FREE | PREMIUM | EXPERT | COMMUNITY:<slug>
  status      subscription_status NOT NULL DEFAULT 'ACTIVE',
  current_period_end timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  currency    text NOT NULL DEFAULT 'BRL',
  provider    text,
  provider_ref text,
  status      text NOT NULL DEFAULT 'PENDING',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────── triggers updated_at ─────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','users','profiles','posts','comments','connections','groups','opportunities','subscriptions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
