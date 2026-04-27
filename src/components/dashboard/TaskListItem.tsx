"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Project, Task, User } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  backlog: "var(--status-backlog)",
  todo:    "var(--status-todo)",
  doing:   "var(--status-doing)",
  review:  "var(--status-review)",
  done:    "var(--status-done)",
};
const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo:    "A Fazer",
  doing:   "Em Progresso",
  review:  "Revisão",
  done:    "Concluído",
};

interface TaskListItemProps {
  task: Task;
  projects: Project[];
  users: User[];
  showPriority?: boolean;
  showOverdue?: boolean;
  showAssignee?: boolean;
  showReviewTime?: boolean;
  onToggleDone?: () => void;
  onClick?: () => void;
  canEdit?: boolean;
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "hoje";
  if (days === 1) return "há 1 dia";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "há 1 semana";
  return `há ${weeks} semanas`;
}

export function TaskListItem({
  task, projects, users,
  showPriority = false,
  showOverdue = false,
  showAssignee = false,
  showReviewTime = false,
  onToggleDone, onClick, canEdit = true,
}: TaskListItemProps) {
  const project = projects.find((p) => p.id === task.projectId);
  const assignee = users.find((u) => u.id === task.assignedTo);
  const isOverdue = showOverdue && task.deadline && new Date(task.deadline) < new Date();
  const showPrioBadge = showPriority && (task.priority === "high" || task.priority === "critical");

  return (
    <li>
      <div
        onClick={onClick}
        onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
        tabIndex={onClick ? 0 : -1}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 12px", borderRadius: 10,
          cursor: onClick ? "pointer" : "default",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {onToggleDone && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); if (canEdit) onToggleDone(); }}
            disabled={!canEdit}
            aria-label={task.checked ? "Desmarcar tarefa" : "Marcar como concluída"}
            whileTap={canEdit ? { scale: 0.9 } : undefined}
            style={{
              flexShrink: 0,
              width: 22, height: 22, borderRadius: "50%",
              border: `2px solid ${task.checked ? "var(--status-done)" : "var(--border-strong)"}`,
              background: task.checked ? "var(--status-done)" : "transparent",
              cursor: canEdit ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
            }}
          >
            {task.checked && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.18 }}
                style={{ display: "flex" }}
              >
                <Check size={14} color="#fff" strokeWidth={3} />
              </motion.span>
            )}
          </motion.button>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, color: "var(--text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textDecoration: task.checked ? "line-through" : "none",
            opacity: task.checked ? 0.6 : 1,
          }}>
            {task.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4,
              color: STATUS_COLOR[task.status] ?? "var(--text-muted)",
            }}>
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[task.status] }} />
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
            {showPrioBadge && (
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                color: task.priority === "critical" ? "var(--priority-critical)" : "var(--priority-high)",
                padding: "1px 6px", borderRadius: 4,
                background: task.priority === "critical" ? "rgba(226,68,92,0.12)" : "rgba(253,171,61,0.14)",
              }}>
                {task.priority === "critical" ? "Crítica" : "Alta"}
              </span>
            )}
            {isOverdue && task.deadline && (
              <span style={{ fontSize: 11, color: "var(--status-review)", fontWeight: 600 }}>
                {relativeTime(task.deadline)}
              </span>
            )}
            {showReviewTime && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                em revisão {relativeTime(task.updatedAt)}
              </span>
            )}
            {showAssignee && assignee && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span aria-hidden>{assignee.avatar}</span>
                {assignee.name}
              </span>
            )}
          </div>
        </div>

        {project && (
          <span title={project.name} aria-label={project.name} style={{
            flexShrink: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 8,
            background: `color-mix(in srgb, ${project.color} 15%, transparent)`,
            fontSize: 14,
          }}>
            {project.icon}
          </span>
        )}
      </div>
    </li>
  );
}
