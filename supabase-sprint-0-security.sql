-- ============================================================
-- SPRINT 0 — SEGURANÇA (gestor-tarefas-ana)
-- Rodar no SQL Editor do Supabase (projeto: ydnwqptkrftonunyjzoc)
-- Idempotente: pode rodar mais de uma vez sem quebrar
-- ============================================================
-- Cobre:
--   • FASE1.2 → cria notes, routine_items, routine_checks
--   • FASE1.1 → habilita RLS em todas as tabelas (8 tabelas)
--
-- Estratégia de RLS:
--   Backend usa SUPABASE_SERVICE_ROLE_KEY → bypassa RLS por design.
--   App usa JWT custom (não Supabase Auth) → auth.uid() é NULL.
--   Logo: habilitamos RLS SEM policies permissivas para anon/authenticated.
--   Resultado: defesa em profundidade — se a anon key vazar, ninguém lê nada.
-- ============================================================


-- ============================================
-- PARTE 1 — TABELAS FALTANTES (FASE1.2)
-- ============================================

-- 1.1) notes
CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Sem título',
  content    TEXT NOT NULL DEFAULT '',
  pinned     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_user_id_idx          ON notes (user_id);
CREATE INDEX IF NOT EXISTS notes_user_pinned_updated  ON notes (user_id, pinned DESC, updated_at DESC);


-- 1.2) routine_items
CREATE TABLE IF NOT EXISTS routine_items (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routine_items_user_active_sort
  ON routine_items (user_id, active, sort_order);


-- 1.3) routine_checks
CREATE TABLE IF NOT EXISTS routine_checks (
  id              TEXT PRIMARY KEY,
  routine_item_id TEXT NOT NULL REFERENCES routine_items(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  check_date      DATE NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT routine_checks_unique_per_day UNIQUE (routine_item_id, check_date)
);

CREATE INDEX IF NOT EXISTS routine_checks_user_date
  ON routine_checks (user_id, check_date);

CREATE INDEX IF NOT EXISTS routine_checks_item_date
  ON routine_checks (routine_item_id, check_date);


-- ============================================
-- PARTE 2 — RLS EM TODAS AS TABELAS (FASE1.1)
-- ============================================
-- Habilita RLS sem criar policies permissivas → nega tudo para
-- anon/authenticated. service_role bypassa (backend continua ok).

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_shares  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_checks  ENABLE ROW LEVEL SECURITY;


-- ============================================
-- PARTE 3 — VERIFICAÇÃO
-- ============================================
-- Rode os SELECTs abaixo após executar tudo para confirmar.

-- 3.1) Tabelas existentes
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--  ORDER BY table_name;

-- 3.2) RLS habilitado em todas as tabelas (rowsecurity = true)
-- SELECT schemaname, tablename, rowsecurity
--   FROM pg_tables
--  WHERE schemaname = 'public'
--    AND tablename IN ('users','projects','project_shares','tasks',
--                      'subtasks','checklist_items','notes',
--                      'routine_items','routine_checks')
--  ORDER BY tablename;

-- 3.3) Sanity check da nova estrutura
-- SELECT count(*) AS notes_count          FROM notes;
-- SELECT count(*) AS routine_items_count  FROM routine_items;
-- SELECT count(*) AS routine_checks_count FROM routine_checks;
