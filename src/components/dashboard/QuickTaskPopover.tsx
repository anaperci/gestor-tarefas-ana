"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { Project, Task } from "@/lib/types";

interface QuickTaskPopoverProps {
  open: boolean;
  projects: Project[];
  defaultProjectId?: string | null;
  onClose: () => void;
  onCreated: (task: Task) => void;
}

export function QuickTaskPopover({ open, projects, defaultProjectId, onClose, onCreated }: QuickTaskPopoverProps) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? projects[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setError(null);
      setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, defaultProjectId, projects]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async () => {
    if (submitting || !title.trim() || !projectId) return;
    setError(null);
    setSubmitting(true);
    try {
      const task = await api.createTask({
        title: title.trim(),
        projectId,
        status: "todo",
        priority: "medium",
      });
      onCreated(task);
      setTitle("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "var(--overlay)", backdropFilter: "blur(4px)", zIndex: 1500 }}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Nova tarefa"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: 80,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1501,
              width: "min(520px, 92vw)",
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: 14,
              padding: 18,
              boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Nova tarefa</h2>
              <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="O que precisa ser feito?"
              aria-label="Título da tarefa"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                background: "var(--input-bg)", border: "1px solid var(--input-border)",
                color: "var(--text)", fontSize: 15, outline: "none", fontFamily: "inherit",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                aria-label="Projeto"
                style={{
                  flex: 1, padding: "9px 12px", borderRadius: 8,
                  background: "var(--input-bg)", border: "1px solid var(--input-border)",
                  color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none",
                  colorScheme: "var(--color-scheme)" as React.CSSProperties["colorScheme"],
                }}
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>

              <button
                onClick={submit}
                disabled={submitting || !title.trim() || !projectId}
                style={{
                  padding: "9px 18px", borderRadius: 8, border: "none",
                  background: "var(--primary)", color: "#fff",
                  fontSize: 13, fontWeight: 700, cursor: submitting ? "wait" : "pointer",
                  opacity: submitting || !title.trim() ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {submitting ? "Criando…" : "Criar"}
              </button>
            </div>

            {error && (
              <div role="alert" style={{ marginTop: 10, fontSize: 12, color: "#E2445C" }}>{error}</div>
            )}

            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
              Dica: <kbd style={kbdStyle}>Enter</kbd> cria · <kbd style={kbdStyle}>Esc</kbd> fecha
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 4,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  fontSize: 10,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
};
