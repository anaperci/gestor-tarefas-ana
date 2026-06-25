-- ============================================================
-- Clareza · Notificações internas (menções em tarefas)
-- Idempotente. RLS habilitado (acesso só via service_role no servidor).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),          -- quem recebe
  actor_id    TEXT REFERENCES users(id),                    -- quem gerou (mencionou)
  type        TEXT NOT NULL DEFAULT 'mention',
  task_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,                                -- texto curto exibido
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

COMMIT;
