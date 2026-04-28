"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, PanelRightOpen, RotateCw } from "lucide-react";
import { api } from "@/lib/api";
import { useDashboardData } from "@/lib/use-dashboard-data";
import type { Project, Task, User } from "@/lib/types";
import { DashboardHeader } from "./DashboardHeader";
import { TodayTasksBlock } from "./TodayTasksBlock";
import { OverdueTasksBlock } from "./OverdueTasksBlock";
import { ReviewBlock } from "./ReviewBlock";
import { DelegatedBlock } from "./DelegatedBlock";
import { ProjectsGrid } from "./ProjectsGrid";
import { RoutinesBlock } from "./RoutinesBlock";
import { ContentInProductionBlock } from "./ContentInProductionBlock";
import { NotesColumn } from "./NotesColumn";
import { QuickTaskPopover } from "./QuickTaskPopover";
import { DashboardSkeleton } from "./DashboardSkeleton";

interface DashboardViewProps {
  currentUser: User;
  /** Projetos visíveis (vindos do task-manager) — usados pra Quick Task popover */
  projects: Project[];
  /** Users visíveis */
  users: User[];
  canEdit: boolean;
  isAdmin: boolean;
  defaultProjectId?: string | null;
  onOpenTask: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
  onSeeAllProjects: () => void;
  onNewProject?: () => void;
}

export function DashboardView({
  currentUser, projects, users,
  canEdit, isAdmin, defaultProjectId,
  onOpenTask, onOpenProject, onSeeAllProjects, onNewProject,
}: DashboardViewProps) {
  const { data, error, isLoading, mutate } = useDashboardData();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("ordum-notes-open");
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("ordum-notes-open", String(notesOpen));
  }, [notesOpen]);

  // Atalhos: N (nova tarefa), ] (toggle notas)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && canEdit) {
        e.preventDefault();
        setPopoverOpen(true);
      }
      if (e.key === "]") {
        e.preventDefault();
        setNotesOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit]);

  const handleToggleDone = async (task: Task) => {
    const next = !task.checked;
    await api.updateTask(task.id, { checked: next, status: next ? "done" : task.status });
    mutate();
  };

  const handleToggleRoutine = async (routineId: string) => {
    await api.toggleRoutineCheck(routineId);
    mutate();
  };

  const projectsForPopover = useMemo(() => projects.filter((p) => p && p.id), [projects]);

  if (isLoading && !data) return <DashboardSkeleton />;

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
        <AlertCircle size={36} color="var(--status-review)" aria-hidden style={{ margin: "0 auto" }} />
        <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
          Não foi possível carregar o dashboard.
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          {error instanceof Error ? error.message : "Erro desconhecido"}
        </div>
        <button
          onClick={() => mutate()}
          style={{
            marginTop: 14, padding: "9px 18px", borderRadius: 8, border: "none",
            background: "var(--primary)", color: "#fff", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
        >
          <RotateCw size={14} aria-hidden /> Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  return (
    <>
      <div className="dashboard-shell" style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <div
          className="dashboard-main"
          style={{
            flex: 1, overflowY: "auto",
            padding: "24px 32px 80px",
          }}
        >
          <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <DashboardHeader
              data={data}
              canEdit={canEdit}
              onNewTask={() => setPopoverOpen(true)}
            />

            <div className="dashboard-row-2" style={{
              display: "grid",
              gridTemplateColumns: "60fr 40fr",
              gap: 16,
              alignItems: "start",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                <TodayTasksBlock
                  tasks={data.today_tasks}
                  projects={projects}
                  users={users}
                  canEdit={canEdit}
                  onToggleDone={handleToggleDone}
                  onOpen={onOpenTask}
                  delay={0.05}
                />
                <OverdueTasksBlock
                  tasks={data.overdue_tasks}
                  projects={projects}
                  users={users}
                  canEdit={canEdit}
                  onToggleDone={handleToggleDone}
                  onOpen={onOpenTask}
                  delay={0.1}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                {currentUser.role !== "viewer" && (
                  <ReviewBlock
                    tasks={data.review_tasks}
                    projects={projects}
                    users={users}
                    onOpen={onOpenTask}
                    delay={0.15}
                  />
                )}
                {currentUser.role !== "viewer" && (
                  <DelegatedBlock
                    tasks={data.delegated_tasks}
                    projects={projects}
                    users={users}
                    onOpen={onOpenTask}
                    delay={0.2}
                  />
                )}
              </div>
            </div>

            <ProjectsGrid
              projects={data.active_projects}
              isAdmin={isAdmin}
              onOpenProject={onOpenProject}
              onSeeAll={onSeeAllProjects}
              onNewProject={onNewProject}
              delay={0.25}
            />

            <RoutinesBlock
              routines={data.today_routines}
              onToggleCheck={handleToggleRoutine}
              delay={0.3}
            />

            {currentUser.canAccessContent && (
              <ContentInProductionBlock
                currentUserId={currentUser.id}
                delay={0.35}
              />
            )}

            <footer style={{ marginTop: 24, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              <kbd style={kbdStyle}>N</kbd> nova tarefa · <kbd style={kbdStyle}>]</kbd> notas · <kbd style={kbdStyle}>?</kbd> mais atalhos
            </footer>
          </div>
        </div>

        {notesOpen && (
          <div className="dashboard-notes-col">
            <NotesColumn notes={data.recent_notes} onMutate={() => mutate()} onCollapse={() => setNotesOpen(false)} />
          </div>
        )}

        {!notesOpen && (
          <button
            onClick={() => setNotesOpen(true)}
            aria-label="Abrir coluna de notas"
            title="Abrir notas (])"
            className="dashboard-notes-tab"
            style={{
              width: 36,
              background: "var(--primary-soft)",
              borderLeft: "1px solid var(--border)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: "20px 0",
              gap: 14,
              color: "var(--primary)",
              fontFamily: "inherit",
            }}
          >
            <PanelRightOpen size={18} aria-hidden />
            <span style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: 12, fontWeight: 600,
              letterSpacing: 0.5,
              color: "var(--primary)",
            }}>
              Notas
            </span>
          </button>
        )}
      </div>

      <QuickTaskPopover
        open={popoverOpen}
        projects={projectsForPopover}
        defaultProjectId={defaultProjectId}
        onClose={() => setPopoverOpen(false)}
        onCreated={() => mutate()}
      />

      <style>{`
        .dashboard-notes-col { display: block; }
        .dashboard-notes-tab { display: flex; }
        @media (max-width: 1279px) {
          .dashboard-notes-col, .dashboard-notes-tab { display: none !important; }
        }
        @media (max-width: 767px) {
          .dashboard-row-2 { grid-template-columns: 1fr !important; }
          .dashboard-main { padding: 16px !important; }
        }
        @media (max-width: 1023px) {
          .dashboard-row-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 6px",
  borderRadius: 4,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  fontSize: 10, fontWeight: 600,
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  margin: "0 2px",
};
