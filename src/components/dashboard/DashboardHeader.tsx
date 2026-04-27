"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { DashboardPayload } from "@/lib/types";
import { MetricStat } from "./MetricStat";

interface DashboardHeaderProps {
  data: DashboardPayload;
  onNewTask: () => void;
  canEdit: boolean;
}

export function DashboardHeader({ data, onNewTask, canEdit }: DashboardHeaderProps) {
  const overdueCount = data.overdue_tasks.length;
  const todayCount = data.today_tasks.length;

  let subtext: string;
  if (overdueCount > 0) {
    subtext = `Você tem ${overdueCount} tarefa${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}.`;
  } else if (todayCount > 0) {
    subtext = `Você tem ${todayCount} tarefa${todayCount > 1 ? "s" : ""} pra hoje.`;
  } else {
    subtext = "Sem pendências pra hoje. Bom trabalho.";
  }

  let metricLabel: string | null = null;
  if (data.meta.role === "admin") metricLabel = "tarefas concluídas esta semana";
  else if (data.meta.role === "editor") metricLabel = "minhas tarefas concluídas";

  return (
    <motion.section
      aria-label="Resumo do dia"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        background: "var(--primary-soft)",
        border: "1px solid var(--card-border)",
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexWrap: "wrap",
        gap: 24,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <h1 style={{
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontSize: "clamp(22px, 2.4vw, 28px)",
          fontWeight: 600,
          color: "var(--text)",
          margin: 0,
          letterSpacing: "-0.01em",
        }}>
          Boa {data.greeting.period}, {data.greeting.name}.
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", margin: "6px 0 0" }}>
          {subtext}
        </p>
      </div>

      {metricLabel && (
        <MetricStat done={data.weekly_stats.done} total={data.weekly_stats.total} label={metricLabel} />
      )}

      {canEdit && (
        <button
          onClick={onNewTask}
          aria-keyshortcuts="N"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            height: 44, padding: "0 20px", borderRadius: 10, border: "none",
            background: "var(--primary)", color: "#fff",
            fontFamily: "inherit", fontSize: 14, fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 6px 16px var(--primary-ring)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--primary-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--primary)")}
        >
          <Plus size={16} aria-hidden /> Nova tarefa
          <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.85, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.18)" }}>N</span>
        </button>
      )}
    </motion.section>
  );
}
