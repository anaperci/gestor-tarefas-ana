"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Substituto do window.confirm — temático, com foco preso e fechamento via Esc.
 * Para deletes, passar destructive=true (botão vermelho).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const accent = destructive ? "var(--status-review)" : "var(--primary)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--overlay)", backdropFilter: "blur(6px)",
        animation: "fadeIn 0.15s ease-out",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 92vw)",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          padding: 28,
          animation: "fadeUp 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          <div
            aria-hidden
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: destructive ? "rgba(226,68,92,0.12)" : "var(--primary-soft)",
              color: accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="confirm-dialog-title"
              style={{
                fontSize: 16, fontWeight: 700,
                color: "var(--text)", margin: 0, letterSpacing: -0.1,
              }}
            >
              {title}
            </h2>
            {description && (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            aria-label="Fechar"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", padding: 4, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "9px 18px", borderRadius: 10,
              border: "1px solid var(--border-strong)",
              background: "transparent", color: "var(--text)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              padding: "9px 18px", borderRadius: 10,
              border: "none",
              background: accent, color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: destructive
                ? "0 4px 16px rgba(226,68,92,0.3)"
                : "0 4px 16px var(--primary-ring)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
