"use client";

import { motion } from "framer-motion";
import { Check, CheckCircle2, Repeat } from "lucide-react";
import type { DashboardRoutine } from "@/lib/types";
import { BlockCard } from "./BlockCard";

interface RoutinesBlockProps {
  routines: DashboardRoutine[];
  onToggleCheck: (routineId: string) => void;
  delay?: number;
}

export function RoutinesBlock({ routines, onToggleCheck, delay }: RoutinesBlockProps) {
  if (routines.length === 0) return null;

  const allDone = routines.every((r) => r.checked);
  const pending = routines.filter((r) => !r.checked).length;

  return (
    <BlockCard icon={Repeat} iconColor="var(--primary)" title="Rotinas de hoje" count={pending} delay={delay}>
      {allDone ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--status-done)", fontSize: 13, padding: "12px 0" }}>
          <CheckCircle2 size={18} aria-hidden /> Todas as rotinas de hoje feitas.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {routines.map((r) => (
            <li key={r.id}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <motion.button
                  onClick={() => onToggleCheck(r.id)}
                  aria-label={r.checked ? `Desfazer ${r.title}` : `Marcar ${r.title}`}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    flexShrink: 0,
                    width: 22, height: 22, borderRadius: "50%",
                    border: `2px solid ${r.checked ? "var(--status-done)" : "var(--border-strong)"}`,
                    background: r.checked ? "var(--status-done)" : "transparent",
                    cursor: "pointer", padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {r.checked && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.18 }}
                      style={{ display: "flex" }}
                    >
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </motion.span>
                  )}
                </motion.button>
                <span style={{
                  flex: 1, fontSize: 14, color: "var(--text)",
                  textDecoration: r.checked ? "line-through" : "none",
                  opacity: r.checked ? 0.6 : 1,
                }}>
                  {r.title}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  );
}
