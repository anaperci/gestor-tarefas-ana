"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Shortcut } from "@/lib/use-keyboard-shortcuts";

interface ShortcutsHelpProps {
  open: boolean;
  shortcuts: Shortcut[];
  onClose: () => void;
}

function prettify(combo: string): string[] {
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  return combo.split("+").map((part) => {
    const k = part.trim().toLowerCase();
    if (k === "mod") return isMac ? "⌘" : "Ctrl";
    if (k === "shift") return "⇧";
    if (k === "alt") return isMac ? "⌥" : "Alt";
    if (k === "escape") return "Esc";
    if (k === " ") return "Space";
    return k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
  });
}

export function ShortcutsHelp({ open, shortcuts, onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--overlay)", backdropFilter: "blur(6px)",
        animation: "fadeIn 0.15s ease-out",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 92vw)",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          padding: 24,
          animation: "fadeUp 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 id="shortcuts-help-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            Atalhos de teclado
          </h2>
          <button onClick={onClose} aria-label="Fechar"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4, borderRadius: 6, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shortcuts.map((sc) => (
            <div key={sc.combo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "var(--surface-hover)" }}>
              <span style={{ fontSize: 13, color: "var(--text)" }}>{sc.description}</span>
              <span style={{ display: "flex", gap: 4 }}>
                {prettify(sc.combo).map((key, i) => (
                  <kbd
                    key={i}
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      minWidth: 28, height: 26, padding: "0 8px",
                      borderRadius: 6, border: "1px solid var(--border-strong)",
                      background: "var(--surface-2)", color: "var(--text)",
                      fontSize: 12, fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
