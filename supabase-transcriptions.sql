-- ============================================================
-- Clareza · Transcrições de reuniões (Minha Área) + resumo por IA
-- O texto fica no banco; o resumo é gerado por GPT sob demanda.
-- Idempotente. RLS habilitado (acesso só via service_role no servidor).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS meeting_transcriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,            -- texto da transcrição
  summary     TEXT,                     -- resumo gerado por IA (GPT)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_transcriptions_user_idx
  ON meeting_transcriptions (user_id, created_at DESC);

ALTER TABLE meeting_transcriptions ENABLE ROW LEVEL SECURITY;

COMMIT;
