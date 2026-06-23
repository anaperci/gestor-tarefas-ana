-- ============================================
-- Workspaces — gestor-tarefas-ana (Ordum)
-- Adiciona camada Workspace > Projeto > Tarefa
-- Acesso liberado por workspace (membros); project_shares passa a
-- funcionar como RESTRIÇÃO de projeto dentro do workspace.
--
-- Rodar no Supabase SQL Editor. Idempotente — pode rodar mais de uma vez.
-- ============================================

BEGIN;

-- ── 1. Tabela de Workspaces ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#7B61FF',
  icon        TEXT DEFAULT '🗂️',
  owner_id    TEXT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- ── 2. Membros do Workspace (quem tem acesso) ────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (workspace_id, user_id)
);

-- ── 3. Vínculo projeto → workspace ───────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- ── 4. Migração: workspace "Geral" + adoção dos projetos existentes ──
-- Dono = primeiro admin encontrado.
INSERT INTO workspaces (id, name, color, icon, owner_id)
SELECT 'ws-geral', 'Geral', '#7B61FF', '🗂️', u.id
FROM users u
WHERE u.role = 'admin' AND u.deleted_at IS NULL
ORDER BY u.created_at
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Todo projeto sem workspace vai pro "Geral"
UPDATE projects SET workspace_id = 'ws-geral' WHERE workspace_id IS NULL;

-- Vira membro do "Geral": todos os admins + donos de projeto + quem já tinha compartilhamento
INSERT INTO workspace_members (workspace_id, user_id)
SELECT 'ws-geral', u.id FROM users u
WHERE u.deleted_at IS NULL AND (
       u.role = 'admin'
    OR u.id IN (SELECT owner_id FROM projects)
    OR u.id IN (SELECT user_id  FROM project_shares)
)
ON CONFLICT DO NOTHING;

-- ── 5. RPCs de acesso (não-admin) ────────────────────────────────────
-- Regra: vê o projeto se for dono, OU tiver tarefa atribuída, OU for
-- membro do workspace E (o projeto não tem restrição específica OU está
-- na lista de liberados do projeto).
CREATE OR REPLACE FUNCTION get_user_projects(p_user_id TEXT)
RETURNS SETOF projects AS $$
  SELECT DISTINCT p.* FROM projects p
  LEFT JOIN workspace_members wm
    ON wm.workspace_id = p.workspace_id AND wm.user_id = p_user_id
  LEFT JOIN project_shares ps
    ON ps.project_id = p.id AND ps.user_id = p_user_id
  LEFT JOIN tasks t
    ON t.project_id = p.id AND t.assigned_to = p_user_id AND t.deleted_at IS NULL
  WHERE p.deleted_at IS NULL
    AND (
         p.owner_id = p_user_id
      OR t.id IS NOT NULL
      OR (
           wm.user_id IS NOT NULL
           AND (
                NOT EXISTS (SELECT 1 FROM project_shares ps2 WHERE ps2.project_id = p.id)
             OR ps.user_id IS NOT NULL
           )
         )
    )
  ORDER BY p.created_at;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_user_tasks(p_user_id TEXT)
RETURNS SETOF tasks AS $$
  SELECT DISTINCT t.* FROM tasks t
  JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
  LEFT JOIN workspace_members wm
    ON wm.workspace_id = p.workspace_id AND wm.user_id = p_user_id
  LEFT JOIN project_shares ps
    ON ps.project_id = p.id AND ps.user_id = p_user_id
  WHERE t.deleted_at IS NULL
    AND (
         p.owner_id = p_user_id
      OR t.assigned_to = p_user_id
      OR (
           wm.user_id IS NOT NULL
           AND (
                NOT EXISTS (SELECT 1 FROM project_shares ps2 WHERE ps2.project_id = p.id)
             OR ps.user_id IS NOT NULL
           )
         )
    )
  ORDER BY t.created_at DESC;
$$ LANGUAGE sql STABLE;

-- ── 6. RLS (defesa em profundidade — service_role faz bypass) ────────
ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── Verificação (rode separado se quiser conferir) ───────────────────
-- SELECT id, name, owner_id FROM workspaces;
-- SELECT workspace_id, count(*) FROM projects GROUP BY workspace_id;
-- SELECT workspace_id, count(*) FROM workspace_members GROUP BY workspace_id;
