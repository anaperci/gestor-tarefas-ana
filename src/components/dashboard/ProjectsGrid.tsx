"use client";

import { motion } from "framer-motion";
import { FolderOpen, FolderPlus } from "lucide-react";
import type { DashboardProjectSummary } from "@/lib/types";
import { BlockCard } from "./BlockCard";

interface ProjectsGridProps {
  projects: DashboardProjectSummary[];
  isAdmin: boolean;
  onOpenProject: (projectId: string) => void;
  onSeeAll: () => void;
  onNewProject?: () => void;
  delay?: number;
}

export function ProjectsGrid({ projects, isAdmin, onOpenProject, onSeeAll, onNewProject, delay }: ProjectsGridProps) {
  const action = projects.length > 0 ? (
    <button
      onClick={onSeeAll}
      style={{ background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}
    >
      Ver todos
    </button>
  ) : undefined;

  return (
    <BlockCard icon={FolderOpen} iconColor="var(--primary)" title="Projetos" count={projects.length} action={action} delay={delay}>
      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <div aria-hidden style={{
            width: 80, height: 80, borderRadius: 16,
            background: "var(--primary-soft)", color: "var(--primary)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
          }}>
            <FolderPlus size={36} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            {isAdmin ? "Crie seu primeiro projeto pra começar." : "Aguardando convite pra um projeto."}
          </div>
          {isAdmin && onNewProject && (
            <button
              onClick={onNewProject}
              style={{
                marginTop: 14, padding: "10px 20px", borderRadius: 10, border: "none",
                background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Criar projeto
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}>
          {projects.map((p, i) => {
            const pct = p.total_count > 0 ? Math.round((p.done_count / p.total_count) * 100) : 0;
            return (
              <motion.button
                key={p.id}
                onClick={() => onOpenProject(p.id)}
                aria-label={`Abrir projeto ${p.name}`}
                whileHover={{ y: -2, boxShadow: `0 8px 24px color-mix(in srgb, ${p.color} 18%, transparent)` }}
                transition={{ duration: 0.18 }}
                style={{
                  textAlign: "left", padding: 16, borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer", height: 140,
                  display: "flex", flexDirection: "column",
                  fontFamily: "inherit",
                }}
                custom={i}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span aria-hidden style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `color-mix(in srgb, ${p.color} 18%, transparent)`,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>
                    {p.icon}
                  </span>
                  <span style={{
                    flex: 1, fontFamily: "var(--font-poppins), Poppins, sans-serif",
                    fontSize: 15, fontWeight: 600, color: "var(--text)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {p.name}
                  </span>
                </div>
                <div style={{ marginTop: "auto" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{p.open_count}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>tarefas abertas</span>
                  </div>
                  <div style={{ marginTop: 8, height: 5, borderRadius: 4, background: "var(--input-bg)", overflow: "hidden" }} aria-hidden>
                    <div style={{ width: `${pct}%`, height: "100%", background: p.color, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                    {pct}% concluído
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </BlockCard>
  );
}
