"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, ShieldCheck, User as UserIcon } from "lucide-react";

interface SetupCheckResponse { setupRequired: boolean }

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json() as Promise<SetupCheckResponse>)
      .then((data) => {
        setSetupRequired(data.setupRequired);
        setChecking(false);
        if (!data.setupRequired) router.replace("/");
      })
      .catch(() => {
        setError("Não foi possível verificar o status do sistema.");
        setChecking(false);
      });
  }, [router]);

  const submit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Falha ao criar administrador");
      }
      localStorage.setItem("taskhub-token", data.token);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)" }}>
          <Loader2 size={18} className="spin" /> Verificando sistema…
        </div>
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  if (!setupRequired) return null;

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", color: "var(--text)", padding: 24,
    }}>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          width: "min(440px, 100%)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
          padding: 36,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: -0.2 }}>Configurar Ordum</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "2px 0 0" }}>Crie o primeiro administrador</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Seu nome" id="name">
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ana Paula Perci"
              autoComplete="name"
              autoFocus
              style={inputStyle}
            />
          </Field>

          <Field label="Username" id="username" hint="Letras minúsculas, sem espaço">
            <div style={{ position: "relative" }}>
              <span aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex" }}>
                <UserIcon size={16} />
              </span>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                placeholder="anapaula"
                autoComplete="username"
                style={{ ...inputStyle, paddingLeft: 38 }}
              />
            </div>
          </Field>

          <Field label="Senha" id="password" hint="≥ 8 caracteres, 1 maiúscula, 1 número">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="••••••••"
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>

          {error && (
            <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(226,68,92,0.1)", color: "#E2445C", fontSize: 13 }}>
              <AlertCircle size={16} aria-hidden /> {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting || !name.trim() || !username.trim() || !password}
            style={{
              marginTop: 8,
              padding: "12px 18px", borderRadius: 12, border: "none",
              background: "var(--primary)", color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: submitting ? "wait" : "pointer",
              opacity: submitting || !name.trim() || !username.trim() || !password ? 0.6 : 1,
              boxShadow: "0 4px 16px var(--primary-ring)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {submitting ? <><Loader2 size={16} className="spin" aria-hidden /> Criando…</> : "Criar admin e entrar"}
          </button>
        </div>
      </motion.section>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: 0.2 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  background: "var(--input-bg)",
  border: "1.5px solid var(--input-border)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};
