-- ============================================================
-- Clareza · Conteúdo dentro do Workspace
-- Escopa content_items por workspace (camada Workspace > Conteúdo).
-- Idempotente — pode rodar de novo sem efeito colateral.
-- ============================================================

BEGIN;

-- 1. Coluna workspace_id (nullable; conteúdo "solto" = sem workspace)
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;

-- 2. Backfill: herda o workspace do projeto vinculado, quando houver
UPDATE content_items c
SET workspace_id = p.workspace_id
FROM projects p
WHERE c.linked_project_id = p.id
  AND c.workspace_id IS NULL
  AND p.workspace_id IS NOT NULL;

-- 3. Índice pra filtrar lista por workspace
CREATE INDEX IF NOT EXISTS content_items_workspace_idx
  ON content_items (workspace_id, updated_at DESC);

COMMIT;
