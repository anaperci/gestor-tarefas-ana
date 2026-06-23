-- ============================================================
-- PASSWORD RESET — "esqueci minha senha" (Ordum)
-- Rodar no SQL Editor do Supabase (projeto: ydnwqptkrftonunyjzoc)
-- Idempotente: pode rodar mais de uma vez
-- ============================================================
-- Cobre:
--   • Coluna users.email (opcional, única entre usuários vivos)
--   • Coluna users.password_changed_at (revoga sessões JWT antigas no reset)
--   • Tabela password_reset_tokens (uso único, hash + expiração + purpose)
--
-- NOTA: neste banco a tabela password_reset_tokens JÁ EXISTIA (vazia), criada
-- por uma tentativa anterior, com a coluna `purpose` (NOT NULL) e SEM
-- `requested_ip`. Por isso o script é ADITIVO: cria o que falta e reconcilia
-- o schema, sem dropar nada nem mexer em RLS/índices pré-existentes.
-- IMPORTANTE: rode este script ANTES de subir o deploy que usa essas colunas.
-- ============================================================

-- ============================================
-- PARTE 1 — Usuário: email + carimbo de troca de senha
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Unicidade case-insensitive entre usuários NÃO deletados.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (lower(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;


-- ============================================
-- PARTE 2 — Tokens de redefinição
-- ============================================

-- Definição completa (para bancos novos). No-op se a tabela já existir.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,           -- hash do token bruto (nunca guardamos o bruto)
  purpose       TEXT NOT NULL DEFAULT 'password_reset',
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,             -- preenchido quando o token é consumido
  requested_ip  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reconciliação com a tabela pré-existente (que tinha purpose mas não requested_ip).
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS requested_ip TEXT;
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE password_reset_tokens ALTER COLUMN purpose SET DEFAULT 'password_reset';

-- Índices (IF NOT EXISTS — aditivos; filtram por hash e por usuário).
CREATE INDEX IF NOT EXISTS prt_token_hash_idx ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS prt_user_idx ON password_reset_tokens (user_id);
