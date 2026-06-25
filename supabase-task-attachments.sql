-- ============================================================
-- Clareza · Anexos de tarefas (Supabase Storage: bucket privado)
-- O arquivo vive no bucket "task-attachments"; aqui só os metadados.
-- Idempotente. RLS habilitado (acesso só via service_role no servidor).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS task_attachments (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by   TEXT NOT NULL REFERENCES users(id),
  file_name     TEXT NOT NULL,            -- nome original do arquivo
  storage_path  TEXT NOT NULL,            -- caminho dentro do bucket
  mime_type     TEXT,
  size_bytes    BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_attachments_task_idx
  ON task_attachments (task_id, created_at);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

COMMIT;
