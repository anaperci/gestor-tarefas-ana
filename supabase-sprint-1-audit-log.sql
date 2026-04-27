-- ============================================================
-- SPRINT 1 — AUDIT LOG (Ordum)
-- Rodar no SQL Editor do Supabase (projeto: ydnwqptkrftonunyjzoc)
-- Idempotente
-- ============================================================
-- Cobre FASE2.7 — rastreabilidade de ações sensíveis (LGPD-friendly).
-- Backend usa service_role (bypassa RLS), então a tabela só é acessível
-- via API. Mesmo assim habilitamos RLS por defesa em profundidade.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role    TEXT,
  action        TEXT NOT NULL,            -- e.g. 'user.delete', 'project.share'
  resource      TEXT NOT NULL,            -- e.g. 'users', 'projects', 'tasks'
  resource_id   TEXT,
  metadata      JSONB,                    -- payload livre (ex: target_user_id)
  ip            TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
  ON audit_logs (resource, resource_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
