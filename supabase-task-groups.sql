-- ════════════════════════════════════════════════════════════════════
-- TASK GROUPS — grupos de verdade DENTRO de um projeto (estilo monday)
-- Antes: "grupo" == "projeto" (o board só agrupava por project_id e o
-- botão "Novo grupo" criava um projeto novo, que ia parar na sidebar).
-- Agora: projeto → task_groups → tasks.
-- Idempotente. Roda inteiro em transação.
-- ════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Tabela ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_groups (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#15708C',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_groups_project ON task_groups(project_id) WHERE deleted_at IS NULL;

-- ── 2. Coluna em tasks ───────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES task_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);

-- ── 3. Grupos do Lançamento Academy (proj-1) ─────────────────────────
INSERT INTO task_groups (id, project_id, name, color, position) VALUES
  ('tg-academy-criacao',   'proj-1', 'Criação',    '#15708C', 0),
  ('tg-academy-suporte',   'proj-1', 'Suporte',    '#E07A52', 1),
  ('tg-academy-automacoes','proj-1', 'Automações', '#00C875', 2)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Tarefas existentes do projeto vão pro grupo Criação ───────────
UPDATE tasks
   SET group_id = 'tg-academy-criacao'
 WHERE project_id = 'proj-1'
   AND group_id IS NULL
   AND deleted_at IS NULL;

-- ── 5. Projeto "Suporte" criado por engano na sidebar (0 tarefas) ────
UPDATE projects
   SET deleted_at = now()
 WHERE id = 'proj-3dd33a7e'
   AND deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = 'proj-3dd33a7e' AND t.deleted_at IS NULL);

-- ── 6. RLS (defesa em profundidade — service_role faz bypass) ────────
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;

COMMIT;
