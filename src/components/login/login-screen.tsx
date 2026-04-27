"use client";

import { LoginForm } from "./login-form";
import { LoginHeroPanel } from "./login-hero-panel";
import type { User } from "@/lib/types";

interface LoginScreenProps {
  onLogin: (user: User) => void;
  mode: "dark" | "light";
  onToggleTheme: () => void;
}

/**
 * Tela de login do Ordum — split screen 50/50 em desktop, empilha no mobile.
 * O backend (POST /api/auth/login) não muda — só a UI.
 */
export function LoginScreen({ onLogin, mode, onToggleTheme }: LoginScreenProps) {
  return (
    <main
      className="login-shell"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg)",
      }}
    >
      <LoginHeroPanel />
      <LoginForm onLogin={onLogin} mode={mode} onToggleTheme={onToggleTheme} />

      <style>{`
        @media (max-width: 1023px) {
          .login-shell {
            flex-direction: column !important;
          }
        }
      `}</style>
    </main>
  );
}
