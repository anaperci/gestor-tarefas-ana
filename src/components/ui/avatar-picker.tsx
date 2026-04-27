"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import {
  AVATAR_SEEDS,
  AVATAR_STYLES,
  composeAvatar,
  parseAvatar,
  UserAvatar,
  type AvatarStyleId,
} from "./user-avatar";

interface AvatarPickerProps {
  open: boolean;
  currentAvatar: string;
  userName: string;
  onSelect: (newAvatar: string) => void;
  onCancel: () => void;
}

export function AvatarPicker({ open, currentAvatar, userName, onSelect, onCancel }: AvatarPickerProps) {
  const initial = parseAvatar(currentAvatar);
  const [styleId, setStyleId] = useState<AvatarStyleId>(
    (initial.kind === "dicebear" && initial.styleId) || "adventurer"
  );
  const [seed, setSeed] = useState<string>(
    (initial.kind === "dicebear" && initial.seed) || AVATAR_SEEDS[0]
  );

  if (!open) return null;

  const composed = composeAvatar(styleId, seed);
  const isCurrent = composed === currentAvatar;

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
          width: "min(520px, 94vw)",
          maxHeight: "92vh",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--card-border)",
          padding: 24,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          animation: "fadeUp 0.2s ease-out",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
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

        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px" }}>
          Escolha o estilo que combina com você.
        </p>

        {/* Toggle de estilos */}
        <div
          role="tablist"
          aria-label="Estilo de avatar"
          style={{
            display: "flex",
            gap: 4,
            background: "var(--surface-2)",
            padding: 4,
            borderRadius: 12,
            border: "1px solid var(--card-border)",
            marginBottom: 16,
          }}
        >
          {AVATAR_STYLES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={styleId === s.id}
              onClick={() => setStyleId(s.id)}
              title={s.hint}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                background: styleId === s.id ? "var(--primary)" : "transparent",
                color: styleId === s.id ? "#fff" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Grid de seeds */}
        <div
          role="radiogroup"
          aria-label={`Avatares ${AVATAR_STYLES.find((s) => s.id === styleId)?.label ?? ""}`}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 18,
            overflowY: "auto",
            minHeight: 0,
          }}
        >
          {AVATAR_SEEDS.map((s) => {
            const checked = seed === s;
            return (
              <button
                key={s}
                onClick={() => setSeed(s)}
                role="radio"
                aria-checked={checked}
                aria-label={`Avatar ${s}`}
                style={{
                  position: "relative",
                  padding: 8,
                  borderRadius: 12,
                  border: `2px solid ${checked ? "var(--primary)" : "var(--card-border)"}`,
                  background: checked ? "var(--primary-soft)" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "inherit",
                }}
              >
                <UserAvatar avatar={composeAvatar(styleId, s)} name={s} size={64} />
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{s}</span>
                {checked && (
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
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          {/* Preview do escolhido */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
            <UserAvatar avatar={composed} name={userName} size={40} />
            <span><strong style={{ color: "var(--text)" }}>{userName.split(" ")[0]}</strong> · {AVATAR_STYLES.find((s) => s.id === styleId)?.label}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onCancel}
              style={{
                padding: "9px 16px", borderRadius: 10,
                border: "1px solid var(--border-strong)", background: "transparent",
                color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onSelect(composed)}
              disabled={isCurrent}
              style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: "var(--primary)", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                opacity: isCurrent ? 0.5 : 1,
                boxShadow: "0 4px 16px var(--primary-ring)",
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
