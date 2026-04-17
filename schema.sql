-- LinkedIn Autopilot — PostgreSQL schema
-- Create an empty database in pgAdmin (or RDS), connect, then execute this script.
--
-- App env: PG_HOST, PG_PORT (default 5432), PG_DATABASE, PG_USER, PG_PASSWORD
-- Optional: PG_SSL=true for RDS; PG_SSL_REJECT_UNAUTHORIZED=false only if you use a custom CA.
-- Optional one-time: npm run db:import-json (imports legacy data/*.json if present).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE compose_v2_chats (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  duration_type TEXT NOT NULL CHECK (duration_type IN ('weeks', 'months')),
  duration_value INTEGER NOT NULL CHECK (duration_value > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ
);

CREATE TABLE compose_v2_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES compose_v2_chats (id) ON DELETE CASCADE,
  post_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  theme TEXT NOT NULL,
  content TEXT NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'published', 'rejected')),
  published_at TIMESTAMPTZ,
  linkedin_post_id TEXT,
  image_url TEXT,
  image_prompt TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT uq_compose_v2_posts_chat_index UNIQUE (chat_id, post_index)
);

CREATE INDEX idx_compose_v2_posts_chat_id ON compose_v2_posts (chat_id);

CREATE TABLE scheduled_approvals (
  id UUID PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES compose_v2_chats (id) ON DELETE CASCADE,
  chat_title TEXT NOT NULL,
  post_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  theme TEXT NOT NULL,
  content TEXT NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'published', 'rejected')),
  published_at TIMESTAMPTZ,
  linkedin_post_id TEXT,
  rejected_at TIMESTAMPTZ,
  image_url TEXT,
  image_prompt TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_scheduled_approvals_chat_id ON scheduled_approvals (chat_id);
CREATE INDEX idx_scheduled_approvals_status_scheduled ON scheduled_approvals (status, scheduled_date);

CREATE TABLE published_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_post_id TEXT NOT NULL,
  content TEXT NOT NULL,
  week INTEGER,
  theme TEXT,
  published_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_published_posts_published_at ON published_posts (published_at DESC);

-- Existing databases: add FLUX image columns (safe to re-run).
ALTER TABLE compose_v2_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE compose_v2_posts ADD COLUMN IF NOT EXISTS image_prompt TEXT;
ALTER TABLE scheduled_approvals ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE scheduled_approvals ADD COLUMN IF NOT EXISTS image_prompt TEXT;

-- Multi-image JSON arrays (safe to re-run).
ALTER TABLE compose_v2_posts ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE scheduled_approvals ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE compose_v2_posts
SET images = jsonb_build_array(trim(image_url))
WHERE image_url IS NOT NULL
  AND trim(image_url) <> ''
  AND jsonb_array_length(COALESCE(images, '[]'::jsonb)) = 0;

UPDATE scheduled_approvals
SET images = jsonb_build_array(trim(image_url))
WHERE image_url IS NOT NULL
  AND trim(image_url) <> ''
  AND jsonb_array_length(COALESCE(images, '[]'::jsonb)) = 0;
