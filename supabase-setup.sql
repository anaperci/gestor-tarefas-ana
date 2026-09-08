-- ============================================
-- Supabase Setup: gestor-tarefas-ana (Task Hub)
-- Rodar no Supabase SQL Editor
-- ============================================

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  avatar TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Projetos
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#7B61FF',
  icon TEXT DEFAULT '📌',
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Compartilhamento de Projetos
CREATE TABLE IF NOT EXISTS project_shares (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

-- 4. Tabela de Tarefas
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  deadline TEXT DEFAULT '',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  link TEXT DEFAULT '',
  checked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Subtarefas
CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'todo',
  checked BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

-- 6. Checklist
CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- Funções RPC (acesso não-admin)
-- ============================================

CREATE OR REPLACE FUNCTION get_user_tasks(p_user_id TEXT)
RETURNS SETOF tasks AS $$
  SELECT DISTINCT t.* FROM tasks t
  JOIN projects p ON t.project_id = p.id
  LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = p_user_id
  WHERE p.owner_id = p_user_id
     OR ps.user_id IS NOT NULL
     OR t.assigned_to = p_user_id
  ORDER BY t.created_at DESC;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_user_projects(p_user_id TEXT)
RETURNS SETOF projects AS $$
  SELECT DISTINCT p.* FROM projects p
  LEFT JOIN project_shares ps ON p.id = ps.project_id
  LEFT JOIN tasks t ON t.project_id = p.id AND t.assigned_to = p_user_id
  WHERE p.owner_id = p_user_id
     OR ps.user_id = p_user_id
     OR t.id IS NOT NULL
  ORDER BY p.created_at;
$$ LANGUAGE sql STABLE;

-- ============================================
-- Seeds removidos. Configure o primeiro admin por bootstrap autorizado.
