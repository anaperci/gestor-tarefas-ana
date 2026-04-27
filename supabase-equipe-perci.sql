-- ============================================================
-- ORDUM — Equipe inicial (PERCI)
-- Rodar no SQL Editor do Supabase (projeto: ydnwqptkrftonunyjzoc)
-- Idempotente: pode rodar mais de uma vez sem duplicar
-- ============================================================
-- Cria/atualiza 4 usuários com bcrypt nativo do Postgres (pgcrypto).
-- bcryptjs do Node entende perfeitamente o $2a$ que pgcrypto gera.
--
-- Senhas (cumprem a política ≥8 + maiúscula + minúscula + dígito):
--   anapaula → Anapaula@890   (admin)
--   ariel    → Equipe@890     (admin)
--   pedro    → Equipe@890     (editor)
--   paulo    → Equipe@890     (editor)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1) anapaula — admin ──────────────────────────────────────
INSERT INTO users (id, username, name, password_hash, role, avatar)
VALUES (
  'user-anapaula',
  'anapaula',
  'Ana Paula',
  crypt('Anapaula@890', gen_salt('bf', 10)),
  'admin',
  '👑'
)
ON CONFLICT (username) DO UPDATE SET
  name          = EXCLUDED.name,
  password_hash = crypt('Anapaula@890', gen_salt('bf', 10)),
  role          = 'admin',
  avatar        = '👑',
  deleted_at    = NULL;

-- ── 2) ariel — admin ─────────────────────────────────────────
INSERT INTO users (id, username, name, password_hash, role, avatar)
VALUES (
  'user-ariel',
  'ariel',
  'Ariel',
  crypt('Equipe@890', gen_salt('bf', 10)),
  'admin',
  '👑'
)
ON CONFLICT (username) DO UPDATE SET
  name          = EXCLUDED.name,
  password_hash = crypt('Equipe@890', gen_salt('bf', 10)),
  role          = 'admin',
  avatar        = '👑',
  deleted_at    = NULL;

-- ── 3) pedro — editor (colaborador de equipe) ────────────────
INSERT INTO users (id, username, name, password_hash, role, avatar)
VALUES (
  'user-pedro',
  'pedro',
  'Pedro',
  crypt('Equipe@890', gen_salt('bf', 10)),
  'editor',
  '✏️'
)
ON CONFLICT (username) DO UPDATE SET
  name          = EXCLUDED.name,
  password_hash = crypt('Equipe@890', gen_salt('bf', 10)),
  role          = 'editor',
  avatar        = '✏️',
  deleted_at    = NULL;

-- ── 4) paulo — editor (colaborador de equipe) ────────────────
INSERT INTO users (id, username, name, password_hash, role, avatar)
VALUES (
  'user-paulo',
  'paulo',
  'Paulo',
  crypt('Equipe@890', gen_salt('bf', 10)),
  'editor',
  '✏️'
)
ON CONFLICT (username) DO UPDATE SET
  name          = EXCLUDED.name,
  password_hash = crypt('Equipe@890', gen_salt('bf', 10)),
  role          = 'editor',
  avatar        = '✏️',
  deleted_at    = NULL;


-- ── (Opcional) limpar seeds de teste antigos ─────────────────
-- Descomente se quiser remover maria e joao que vieram do seed
-- UPDATE users SET deleted_at = now() WHERE username IN ('maria', 'joao') AND deleted_at IS NULL;


-- ── Verificação ──────────────────────────────────────────────
SELECT username, name, role, avatar,
       CASE WHEN deleted_at IS NULL THEN 'ativo' ELSE 'arquivado' END AS status
  FROM users
 WHERE username IN ('anapaula', 'ariel', 'pedro', 'paulo')
 ORDER BY role, username;
