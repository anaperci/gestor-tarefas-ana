"use client";

import { LoginForm } from "./login-form";
import { LoginHeroPanel } from "./login-hero-panel";
import type { User } from "@/lib/types";

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

/**
 * Tela de login do Ordum — split screen 50/50 em desktop, empilha no mobile.
 * Sistema é light-only.
 */
export function LoginScreen({ onLogin }: LoginScreenProps) {
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
      <LoginForm onLogin={onLogin} />

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
