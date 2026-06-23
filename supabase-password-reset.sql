-- ============================================
-- Reset de senha + Email de acesso (Brevo)
-- gestor-tarefas-ana (Ordum)
--
-- Adiciona email ao usuário e tabela de tokens de redefinição de senha.
-- Rodar no Supabase SQL Editor. Idempotente.
-- ============================================

BEGIN;

-- ── 1. Email no usuário ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Email único (case-insensitive) quando preenchido
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users (lower(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

-- ── 2. Tokens de redefinição de senha ────────────────────────────────
-- Guardamos só o HASH do token (sha256). O token em claro vai no link do email.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'reset' CHECK (purpose IN ('reset', 'welcome')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);

-- RLS (defesa em profundidade — service_role faz bypass)
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── Verificação ──────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'users' AND column_name = 'email';
