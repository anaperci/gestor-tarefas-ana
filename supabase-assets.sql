-- ============================================================
-- Clareza · Assets (links de drives/recursos da empresa)
-- Idempotente. RLS habilitado (acesso só via service_role no servidor).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS asset_links (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_by  TEXT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_links_order_idx ON asset_links (sort_order, created_at);

ALTER TABLE asset_links ENABLE ROW LEVEL SECURITY;

COMMIT;
