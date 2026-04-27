-- ============================================================
-- ORDUM — Tags globais + Timeline + Estimativa
-- Rodar no SQL Editor do Supabase (projeto: ydnwqptkrftonunyjzoc)
-- Idempotente
-- ============================================================

-- ── Tabela de tags globais ───────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#7B61FF',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS tags_alive_idx
  ON tags (created_at) WHERE deleted_at IS NULL;

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- ── Novos campos em tasks ────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tag_ids        JSONB     DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date     TEXT      DEFAULT '';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_hours NUMERIC(6,2);

-- Index pra filtrar por tag (raro mas útil quando tiver volume)
CREATE INDEX IF NOT EXISTS tasks_tag_ids_idx
  ON tasks USING GIN (tag_ids)
  WHERE deleted_at IS NULL;

-- ── Verificação ──────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tags') AS has_tags_table,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name='tasks' AND column_name IN ('tag_ids','start_date','estimate_hours')) AS new_task_columns;
