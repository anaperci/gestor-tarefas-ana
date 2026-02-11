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
-- Seed Data
-- ============================================

-- Usuários
INSERT INTO users (id, username, name, password_hash, role, avatar) VALUES
  ('user-1', 'anapaula', 'Ana Paula', 'h_9wn2ys', 'admin', '👑'),
  ('user-2', 'maria', 'Maria Silva', 'h_41txfg', 'editor', '🎨'),
  ('user-3', 'joao', 'João Santos', 'h_ns75cx', 'viewer', '👁️'),
  ('user-4', 'ariel', 'Ariel', 'h_bx25iq', 'editor', '✏️')
ON CONFLICT (id) DO NOTHING;

-- Projetos
INSERT INTO projects (id, name, color, icon, owner_id) VALUES
  ('proj-1', 'PERCI', '#7B61FF', '🚀', 'user-1'),
  ('proj-2', 'NexIA Lab', '#00C875', '🤖', 'user-1'),
  ('proj-3', 'Imersão 10K', '#FF6B6B', '🔥', 'user-1')
ON CONFLICT (id) DO NOTHING;

-- Compartilhamentos
INSERT INTO project_shares (project_id, user_id) VALUES
  ('proj-1', 'user-2'),
  ('proj-1', 'user-3'),
  ('proj-2', 'user-2')
ON CONFLICT DO NOTHING;

-- Tarefas
INSERT INTO tasks (id, title, description, status, priority, deadline, project_id, assigned_to, created_by, link, checked) VALUES
  ('task-seed-01', 'Gravar vídeo de vendas Imersão 10K', 'Gravar o vídeo principal de vendas para a página da Imersão 10K com IA.', 'doing', 'critical', '2026-02-15', 'proj-3', 'user-1', 'user-1', '', false),
  ('task-seed-02', 'Montar knowledge base NexIA', '', 'todo', 'high', '2026-02-20', 'proj-2', 'user-1', 'user-1', 'https://nexia.com.br', false),
  ('task-seed-03', 'Criar prompt de copywriting avançado', '', 'backlog', 'medium', '2026-02-28', 'proj-1', 'user-1', 'user-1', '', false),
  ('task-seed-04', 'Preparar deck governo', 'Deck institucional NexIA Lab.', 'todo', 'high', '2026-03-05', 'proj-2', 'user-1', 'user-1', '', false)
ON CONFLICT (id) DO NOTHING;

-- Checklist
INSERT INTO checklist_items (id, task_id, text, done, sort_order) VALUES
  ('cl-seed-01', 'task-seed-01', 'Escrever roteiro', true, 0),
  ('cl-seed-02', 'task-seed-01', 'Preparar setup', false, 1),
  ('cl-seed-03', 'task-seed-01', 'Gravar', false, 2),
  ('cl-seed-04', 'task-seed-04', 'Levantar cases', false, 0)
ON CONFLICT (id) DO NOTHING;

-- Subtarefas
INSERT INTO subtasks (id, task_id, title, status, checked, sort_order) VALUES
  ('st-seed-01', 'task-seed-01', 'Criar thumbnail', 'todo', false, 0),
  ('st-seed-02', 'task-seed-01', 'Configurar checkout', 'doing', false, 1),
  ('st-seed-03', 'task-seed-04', 'Revisar dados de ROI', 'todo', false, 0)
ON CONFLICT (id) DO NOTHING;
