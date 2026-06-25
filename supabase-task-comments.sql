-- ============================================
-- Comentários de tarefa — Clareza
-- Espelha o padrão de content_comments (ids TEXT, FK p/ users/tasks).
-- Rodar no Supabase SQL Editor. Idempotente.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS task_comments (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_comments_task_idx
  ON task_comments (task_id, created_at);

-- RLS (defesa em profundidade — service_role faz bypass)
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

COMMIT;
