"use client";

import { CSSProperties, useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Lê o token da URL no cliente (evita boundary de Suspense do useSearchParams)
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
  }, []);

  const valid = (p: string) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!token) { setError("Link inválido. Solicite um novo."); return; }
    if (!valid(password)) {
      setError("A senha precisa de ao menos 8 caracteres, com maiúscula, minúscula e número.");
      return;
    }
    if (password !== confirm) { setError("As senhas não conferem."); return; }
    setSubmitting(true);
    try {
      await api.resetPasswordWithToken(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha");
      setSubmitting(false);
    }
  };

  return (
    <main style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <img src="/logos/clareza-lockup-egeu.svg" alt="Clareza" style={{ height: 40 }} />
        </div>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <h1 style={title}>Senha redefinida</h1>
            <p style={subtitle}>Sua nova senha já está valendo. Você já pode entrar.</p>
            <a href="/" style={{ ...btn, display: "inline-flex", textDecoration: "none" }}>Ir para o login</a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 style={title}>Definir nova senha</h1>
            <p style={subtitle}>Escolha uma senha forte para sua conta.</p>

            <label style={label}>Nova senha</label>
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              autoFocus
              style={input}
            />

            <label style={label}>Confirmar senha</label>
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              placeholder="••••••••"
              style={input}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 16px", cursor: "pointer" }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Mostrar senha
            </label>

            {error && <div style={errorBox}>{error}</div>}

            <button type="submit" disabled={submitting} style={{ ...btn, opacity: submitting ? 0.6 : 1, cursor: submitting ? "wait" : "pointer" }}>
              {submitting ? "Salvando…" : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const wrap: CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: "var(--bg)", padding: 24,
};
const card: CSSProperties = {
  width: "100%", maxWidth: 420, background: "var(--surface)", borderRadius: 18,
  border: "1px solid var(--card-border)", boxShadow: "var(--card-shadow)", padding: 32,
};
const title: CSSProperties = {
  fontFamily: "var(--font-marcellus), Georgia, serif", fontSize: 26, color: "var(--text)",
  margin: "12px 0 6px", textAlign: "center" as const, letterSpacing: "0.01em",
};
const subtitle: CSSProperties = {
  fontSize: 14, color: "var(--text-secondary)", textAlign: "center" as const, margin: "0 0 24px",
};
const label: CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6,
};
const input: CSSProperties = {
  width: "100%", height: 46, padding: "0 14px", borderRadius: 10, marginBottom: 14,
  background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)",
  fontSize: 15, outline: "none", fontFamily: "inherit",
};
const btn: CSSProperties = {
  width: "100%", height: 48, borderRadius: 10, border: "none", background: "var(--primary)",
  color: "#fff", fontWeight: 600, fontSize: 15, fontFamily: "inherit",
  alignItems: "center", justifyContent: "center",
};
const errorBox: CSSProperties = {
  fontSize: 13, color: "#E2445C", padding: "10px 12px", borderRadius: 8, marginBottom: 14,
  background: "rgba(226,68,92,0.08)", border: "1px solid rgba(226,68,92,0.2)",
};
