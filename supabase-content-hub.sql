-- ============================================================
-- ORDUM — Content Hub (página /content)
-- Rodar no SQL Editor do Supabase. Idempotente.
-- ============================================================

-- ── 1) Flag de acesso na tabela users ────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_access_content BOOLEAN NOT NULL DEFAULT false;

-- Seed: Ana e Ariel já liberadas
UPDATE users SET can_access_content = true
 WHERE username IN ('anapaula', 'ariel');

-- ── 2) content_items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id                 TEXT PRIMARY KEY,
  title              TEXT DEFAULT '',
  body               TEXT NOT NULL DEFAULT '',
  format             TEXT NOT NULL DEFAULT 'post'
    CHECK (format IN ('post','carousel','video_short','video_long','script_class','email','thread','other')),
  status             TEXT NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea','in_production','published','archived')),
  platform           TEXT
    CHECK (platform IS NULL OR platform IN ('instagram','linkedin','youtube','tiktok','newsletter','multiple','other')),
  target_audience    TEXT DEFAULT '',
  hook               TEXT DEFAULT '',
  cta                TEXT DEFAULT '',
  subject_line       TEXT DEFAULT '',
  preview_text       TEXT DEFAULT '',
  duration_seconds   INTEGER,
  tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  linked_task_id     TEXT REFERENCES tasks(id)    ON DELETE SET NULL,
  scheduled_for      TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  published_url      TEXT DEFAULT '',
  created_by         TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  assigned_to        TEXT REFERENCES users(id)          ON DELETE SET NULL,
  last_edited_by     TEXT REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS content_items_alive_idx
  ON content_items (updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_items_status_idx
  ON content_items (status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_items_assignee_idx
  ON content_items (assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_items_scheduled_idx
  ON content_items (scheduled_for) WHERE deleted_at IS NULL AND scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_items_tags_idx
  ON content_items USING GIN (tags) WHERE deleted_at IS NULL;

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- ── 3) content_slides ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_slides (
  id              TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  slide_number    INTEGER NOT NULL DEFAULT 1,
  title           TEXT DEFAULT '',
  body            TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_slides_item_idx
  ON content_slides (content_item_id, sort_order);

ALTER TABLE content_slides ENABLE ROW LEVEL SECURITY;

-- ── 4) content_comments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_comments (
  id              TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_comments_item_idx
  ON content_comments (content_item_id, created_at DESC);

ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;

-- ── 5) content_status_history (mini-timeline) ────────────────
CREATE TABLE IF NOT EXISTS content_status_history (
  id              TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  changed_by      TEXT NOT NULL REFERENCES users(id),
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_status_history_item_idx
  ON content_status_history (content_item_id, created_at DESC);

ALTER TABLE content_status_history ENABLE ROW LEVEL SECURITY;

-- ── Verificação ──────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='content_items') AS has_content_items,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='content_slides') AS has_slides,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='content_comments') AS has_comments,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='content_status_history') AS has_history,
  (SELECT count(*) FROM users WHERE can_access_content = true) AS users_with_access;
