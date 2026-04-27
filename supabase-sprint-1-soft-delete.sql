-- ============================================================
-- SPRINT 1 — SOFT DELETE (gestor-tarefas-ana / Ordum)
-- Rodar no SQL Editor do Supabase (projeto: ydnwqptkrftonunyjzoc)
-- Idempotente: pode rodar mais de uma vez
-- ============================================================
-- Cobre:
--   • FASE2.2 → adiciona deleted_at em users, projects, tasks, notes
--   • Recria RPCs get_user_tasks/get_user_projects filtrando deleted_at
--   • Índices parciais para manter SELECTs rápidos
-- ============================================================

-- ============================================
-- PARTE 1 — Colunas deleted_at
-- ============================================

ALTER TABLE users    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notes    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índices parciais — pequenos e rápidos pra quem só lê linhas vivas
CREATE INDEX IF NOT EXISTS users_alive_idx
  ON users (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS projects_alive_idx
  ON projects (created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_alive_idx
  ON tasks (project_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notes_alive_idx
  ON notes (user_id, pinned DESC, updated_at DESC) WHERE deleted_at IS NULL;


-- ============================================
-- PARTE 2 — Recriar RPCs respeitando soft delete
-- ============================================

CREATE OR REPLACE FUNCTION get_user_tasks(p_user_id TEXT)
RETURNS SETOF tasks AS $$
  SELECT DISTINCT t.* FROM tasks t
  JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
  LEFT JOIN project_shares ps
    ON p.id = ps.project_id AND ps.user_id = p_user_id
  WHERE t.deleted_at IS NULL
    AND (
         p.owner_id = p_user_id
      OR ps.user_id IS NOT NULL
      OR t.assigned_to = p_user_id
    )
  ORDER BY t.created_at DESC;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_user_projects(p_user_id TEXT)
RETURNS SETOF projects AS $$
  SELECT DISTINCT p.* FROM projects p
  LEFT JOIN project_shares ps ON p.id = ps.project_id
  LEFT JOIN tasks t
    ON t.project_id = p.id
   AND t.assigned_to = p_user_id
   AND t.deleted_at IS NULL
  WHERE p.deleted_at IS NULL
    AND (
         p.owner_id = p_user_id
      OR ps.user_id = p_user_id
      OR t.id IS NOT NULL
    )
  ORDER BY p.created_at;
$$ LANGUAGE sql STABLE;


-- ============================================
-- PARTE 3 — Verificação (descomentar pra rodar)
-- ============================================

-- SELECT table_name, column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND column_name = 'deleted_at'
--  ORDER BY table_name;
--
-- Esperado: 4 linhas (users, projects, tasks, notes)
