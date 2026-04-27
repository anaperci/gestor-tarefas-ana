"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { AVATAR_SEEDS, UserAvatar } from "./user-avatar";

interface AvatarPickerProps {
  open: boolean;
  currentAvatar: string;
  userName: string;
  onSelect: (newAvatar: string) => void;
  onCancel: () => void;
}

export function AvatarPicker({ open, currentAvatar, userName, onSelect, onCancel }: AvatarPickerProps) {
  const [pick, setPick] = useState<string>(currentAvatar);

  if (!open) return null;

  const isCurrent = (s: string) => pick === s;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escolher avatar"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--overlay)", backdropFilter: "blur(6px)",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 92vw)",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          padding: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          animation: "fadeUp 0.2s ease-out",
        }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            Escolher avatar
          </h2>
          <button
            onClick={onCancel}
            aria-label="Fechar"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4, borderRadius: 6, display: "flex" }}
          >
            <X size={18} />
          </button>
        </header>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
          Escolha um avatar pra você. Inspirado em Stardew Valley.
        </p>

        <div
          role="radiogroup"
          aria-label="Seleção de avatar"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {AVATAR_SEEDS.map((seed) => (
            <button
              key={seed}
              onClick={() => setPick(seed)}
              role="radio"
              aria-checked={isCurrent(seed)}
              aria-label={`Avatar ${seed}`}
              style={{
                position: "relative",
                padding: 8,
                borderRadius: 12,
                border: `2px solid ${isCurrent(seed) ? "var(--primary)" : "var(--border)"}`,
                background: isCurrent(seed) ? "var(--primary-soft)" : "transparent",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
              }}
            >
              <UserAvatar avatar={seed} name={seed} size={56} />
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{seed}</span>
              {isCurrent(seed) && (
                <span aria-hidden style={{
                  position: "absolute", top: 4, right: 4,
                  width: 18, height: 18, borderRadius: 999,
                  background: "var(--primary)", color: "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "9px 18px", borderRadius: 10,
              border: "1px solid var(--border-strong)", background: "transparent",
              color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSelect(pick)}
            disabled={pick === currentAvatar}
            style={{
              padding: "9px 18px", borderRadius: 10, border: "none",
              background: "var(--primary)", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              opacity: pick === currentAvatar ? 0.5 : 1,
              boxShadow: "0 4px 16px var(--primary-ring)",
            }}
          >
            Salvar avatar de {userName.split(" ")[0]}
          </button>
        </div>
      </div>
    </div>
  );
}
