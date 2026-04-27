"use client";

import { CSSProperties, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Moon, Sun, User as UserIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface LoginFormProps {
  onLogin: (user: User) => void;
  mode: "dark" | "light";
  onToggleTheme: () => void;
}

export function LoginForm({ onLogin, mode, onToggleTheme }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting || !username.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      const user = await api.login(username.toLowerCase().trim(), password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no login");
      setSubmitting(false);
    }
  };

  return (
    <motion.section
      className="login-form-panel"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      style={{
        flex: 1,
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px",
      }}
    >
      {/* Toggle tema top-right */}
      <button
        onClick={onToggleTheme}
        aria-label={mode === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <form onSubmit={submit} style={{ width: "100%", maxWidth: 400 }}>
        <header style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "var(--font-poppins), Poppins, sans-serif",
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: "-0.01em",
              margin: 0,
              color: "var(--text)",
            }}
          >
            Bem-vinda de volta
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 6 }}>
            Entre com seu usuário e senha.
          </p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Username */}
          <Field id="login-username" label="Usuário">
            <div style={{ position: "relative" }}>
              <span aria-hidden style={iconLeftStyle}>
                <UserIcon size={18} />
              </span>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                placeholder="seu.usuario"
                autoComplete="username"
                autoFocus
                aria-invalid={!!error}
                style={{ ...inputStyle, paddingLeft: 44 }}
              />
            </div>
          </Field>

          {/* Password */}
          <Field id="login-password" label="Senha">
            <div style={{ position: "relative" }}>
              <span aria-hidden style={iconLeftStyle}>
                <Lock size={18} />
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={!!error}
                style={{ ...inputStyle, paddingLeft: 44, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                style={{
                  position: "absolute", right: 8, top: "50%",
                  transform: "translateY(-50%)",
                  width: 32, height: 32, borderRadius: 6,
                  border: "none", background: "transparent",
                  color: "var(--text-muted)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          {/* Erro */}
          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#E2445C",
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(226,68,92,0.08)",
                border: "1px solid rgba(226,68,92,0.2)",
              }}
            >
              <AlertCircle size={16} aria-hidden />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            whileHover={!submitting && username.trim() && password ? { scale: 1.01 } : undefined}
            whileTap={!submitting ? { scale: 0.99 } : undefined}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              marginTop: 8,
              height: 48,
              padding: "0 18px",
              borderRadius: 10,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontFamily: "var(--font-figtree), Figtree, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting || !username.trim() || !password ? 0.6 : 1,
              boxShadow: "0 8px 16px rgba(70, 52, 127, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = "var(--primary-hover)"; }}
            onMouseLeave={(e) => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = "var(--primary)"; }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} aria-hidden style={{ animation: "spin 0.9s linear infinite" }} />
                Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </motion.button>
        </div>
      </form>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1023px) {
          .login-form-panel { min-height: 60vh !important; padding: 32px 24px !important; }
        }
        @media (max-width: 767px) {
          .login-form-panel { min-height: 72vh !important; }
        }
      `}</style>
    </motion.section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: 6,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  borderRadius: 10,
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  color: "var(--text)",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.2s",
};

const iconLeftStyle: CSSProperties = {
  position: "absolute",
  left: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--text-muted)",
  display: "flex",
  pointerEvents: "none",
};
