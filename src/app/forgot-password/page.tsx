"use client";

import { CSSProperties, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting || !email.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.requestPasswordReset(email.toLowerCase().trim());
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao solicitar redefinição");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={shell}>
      <section style={card}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <span aria-hidden style={iconCircle("var(--status-done, #00C875)")}>
              <CheckCircle2 size={26} />
            </span>
            <h1 style={title}>Verifique seu email</h1>
            <p style={subtitle}>
              Se houver uma conta com <strong>{email.toLowerCase().trim()}</strong>, enviamos um link
              para redefinir a senha. Ele expira em 1 hora.
            </p>
            <Link href="/" style={backLink}>
              <ArrowLeft size={15} aria-hidden /> Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <header style={{ marginBottom: 24 }}>
              <h1 style={title}>Esqueceu a senha?</h1>
              <p style={subtitle}>Informe seu email e enviaremos um link para criar uma nova senha.</p>
            </header>

            <label htmlFor="fp-email" style={labelStyle}>Email</label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <span aria-hidden style={iconLeft}><Mail size={18} /></span>
              <input
                id="fp-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="voce@empresa.com"
                autoComplete="email"
                autoFocus
                aria-invalid={!!error}
                style={{ ...inputStyle, paddingLeft: 44 }}
              />
            </div>

            {error && (
              <div role="alert" style={errorBox}>
                <AlertCircle size={16} aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting || !email.trim()} style={primaryBtn(submitting || !email.trim())}>
              {submitting ? (<><Loader2 size={18} aria-hidden style={{ animation: "spin 0.9s linear infinite" }} /> Enviando…</>) : "Enviar link de redefinição"}
            </button>

            <Link href="/" style={{ ...backLink, marginTop: 20 }}>
              <ArrowLeft size={15} aria-hidden /> Voltar ao login
            </Link>
          </form>
        )}
      </section>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

const shell: CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: "var(--bg)", padding: 24, color: "var(--text)",
};
const card: CSSProperties = {
  width: "100%", maxWidth: 420, background: "var(--surface, #fff)",
  border: "1px solid var(--card-border, rgba(0,0,0,0.08))", borderRadius: 16,
  padding: 32, boxShadow: "0 12px 40px rgba(70,52,127,0.10)",
};
const title: CSSProperties = {
  fontFamily: "var(--font-poppins), Poppins, sans-serif", fontWeight: 600, fontSize: 22,
  letterSpacing: "-0.01em", margin: 0, color: "var(--text)",
};
const subtitle: CSSProperties = { fontSize: 14, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.55 };
const labelStyle: CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: 0.2,
};
const inputStyle: CSSProperties = {
  width: "100%", height: 48, padding: "0 14px", borderRadius: 10,
  background: "var(--input-bg)", border: "1px solid var(--input-border)",
  color: "var(--text)", fontSize: 15, outline: "none", fontFamily: "inherit",
};
const iconLeft: CSSProperties = {
  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
  color: "var(--text-muted)", display: "flex", pointerEvents: "none",
};
const errorBox: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#E2445C",
  padding: "8px 12px", borderRadius: 8, marginBottom: 16,
  background: "rgba(226,68,92,0.08)", border: "1px solid rgba(226,68,92,0.2)",
};
const primaryBtn = (disabled: boolean): CSSProperties => ({
  width: "100%", height: 48, padding: "0 18px", borderRadius: 10, border: "none",
  background: "var(--primary)", color: "#fff",
  fontFamily: "var(--font-figtree), Figtree, sans-serif", fontWeight: 600, fontSize: 15,
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
  boxShadow: "0 8px 16px rgba(70,52,127,0.3)",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
});
const backLink: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
  fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", justifyContent: "center", width: "100%",
};
const iconCircle = (color: string): CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 56, height: 56, borderRadius: "50%", marginBottom: 14,
  background: "rgba(0,200,117,0.12)", color,
});
