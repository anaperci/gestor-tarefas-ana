"use client";

import { CSSProperties, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, XCircle } from "lucide-react";
import { api } from "@/lib/api";

type Status = "checking" | "invalid" | "ready" | "done";

function ResetPasswordInner() {
  const token = useSearchParams().get("token") ?? "";

  const [status, setStatus] = useState<Status>("checking");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) { setStatus("invalid"); return; }
    api.validateResetToken(token)
      .then((r) => { if (active) setStatus(r.valid ? "ready" : "invalid"); })
      .catch(() => { if (active) setStatus("invalid"); });
    return () => { active = false; };
  }, [token]);

  const validatePwd = (): string | null => {
    if (pwd.length < 8) return "A senha precisa ter ao menos 8 caracteres";
    if (pwd.length > 128) return "A senha não pode exceder 128 caracteres";
    if (!/[A-Z]/.test(pwd)) return "Inclua ao menos 1 letra maiúscula";
    if (!/[a-z]/.test(pwd)) return "Inclua ao menos 1 letra minúscula";
    if (!/[0-9]/.test(pwd)) return "Inclua ao menos 1 número";
    if (pwd !== confirm) return "As senhas não conferem";
    return null;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    const v = validatePwd();
    if (v) { setError(v); return; }
    setError(null);
    setSubmitting(true);
    try {
      await api.confirmPasswordReset(token, pwd);
      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao redefinir senha";
      setError(msg);
      // Token expirado/usado no meio do caminho → volta pro estado inválido.
      if (/inválido|expirado|utilizado/i.test(msg)) setStatus("invalid");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "checking") {
    return (
      <Centered>
        <Loader2 size={26} aria-hidden style={{ animation: "spin 0.9s linear infinite", color: "var(--primary)" }} />
        <p style={{ ...subtitle, marginTop: 12 }}>Validando o link…</p>
      </Centered>
    );
  }

  if (status === "invalid") {
    return (
      <Centered>
        <span aria-hidden style={iconCircle("#E2445C", "rgba(226,68,92,0.12)")}><XCircle size={26} /></span>
        <h1 style={title}>Link inválido ou expirado</h1>
        <p style={subtitle}>Este link de redefinição não é mais válido. Solicite um novo para continuar.</p>
        <Link href="/forgot-password" style={primaryLink}>Solicitar novo link</Link>
        <Link href="/" style={backLink}><ArrowLeft size={15} aria-hidden /> Voltar ao login</Link>
      </Centered>
    );
  }

  if (status === "done") {
    return (
      <Centered>
        <span aria-hidden style={iconCircle("#00C875", "rgba(0,200,117,0.12)")}><CheckCircle2 size={26} /></span>
        <h1 style={title}>Senha redefinida!</h1>
        <p style={subtitle}>Sua senha foi atualizada. Já pode entrar com a nova senha.</p>
        <Link href="/" style={primaryLink}>Ir para o login</Link>
      </Centered>
    );
  }

  // status === "ready"
  return (
    <section style={card}>
      <form onSubmit={submit}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={title}>Criar nova senha</h1>
          <p style={subtitle}>Escolha uma senha forte que você ainda não usou.</p>
        </header>

        <label htmlFor="rp-pwd" style={labelStyle}>Nova senha</label>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span aria-hidden style={iconLeft}><Lock size={18} /></span>
          <input
            id="rp-pwd"
            type={show ? "text" : "password"}
            value={pwd}
            onChange={(e) => { setPwd(e.target.value); setError(null); }}
            placeholder="••••••••"
            autoComplete="new-password"
            autoFocus
            style={{ ...inputStyle, paddingLeft: 44, paddingRight: 44 }}
          />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} style={eyeBtn}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <label htmlFor="rp-confirm" style={labelStyle}>Confirmar nova senha</label>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <span aria-hidden style={iconLeft}><Lock size={18} /></span>
          <input
            id="rp-confirm"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(null); }}
            placeholder="••••••••"
            autoComplete="new-password"
            style={{ ...inputStyle, paddingLeft: 44 }}
          />
        </div>

        <p style={hint}>Mínimo 8 caracteres, com 1 maiúscula, 1 minúscula e 1 número.</p>

        {error && (
          <div role="alert" style={errorBox}>
            <AlertCircle size={16} aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={submitting || !pwd || !confirm} style={primaryBtn(submitting || !pwd || !confirm)}>
          {submitting ? (<><Loader2 size={18} aria-hidden style={{ animation: "spin 0.9s linear infinite" }} /> Salvando…</>) : "Redefinir senha"}
        </button>
      </form>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main style={shell}>
      <Suspense fallback={<Centered><Loader2 size={26} aria-hidden style={{ animation: "spin 0.9s linear infinite", color: "var(--primary)" }} /></Centered>}>
        <ResetPasswordInner />
      </Suspense>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <section style={{ ...card, textAlign: "center" }}>{children}</section>;
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
const hint: CSSProperties = { fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" };
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
const eyeBtn: CSSProperties = {
  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
  width: 32, height: 32, borderRadius: 6, border: "none", background: "transparent",
  color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
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
const primaryLink: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  height: 46, padding: "0 22px", borderRadius: 10, marginTop: 18,
  background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none",
  boxShadow: "0 8px 16px rgba(70,52,127,0.3)",
};
const backLink: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
  fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none", justifyContent: "center", width: "100%",
};
const iconCircle = (color: string, bg: string): CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 56, height: 56, borderRadius: "50%", marginBottom: 14, background: bg, color,
});
