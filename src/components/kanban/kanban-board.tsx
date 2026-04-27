"use client";

import { CSSProperties, useMemo } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Link2 } from "lucide-react";
import type { Project, Task, TaskStatus, User } from "@/lib/types";
import { useState } from "react";

interface KanbanBoardProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  canEdit: boolean;
  defaultProjectId: string | null;
  onUpdate: (task: Task) => void;
  onOpen: (task: Task) => void;
  onQuickAdd: (projectId: string, status: TaskStatus) => void;
}

const COLUMNS: { value: TaskStatus; label: string; color: string }[] = [
  { value: "backlog", label: "Backlog",       color: "var(--status-backlog)" },
  { value: "todo",    label: "A Fazer",       color: "var(--status-todo)" },
  { value: "doing",   label: "Em Progresso",  color: "var(--status-doing)" },
  { value: "review",  label: "Revisão",       color: "var(--status-review)" },
  { value: "done",    label: "Concluído",     color: "var(--status-done)" },
];

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: "Crítica", color: "var(--priority-critical)" },
  high:     { label: "Alta",    color: "var(--priority-high)" },
  medium:   { label: "Média",   color: "var(--priority-medium)" },
  low:      { label: "Baixa",   color: "var(--priority-low)" },
};

export function KanbanBoard({
  tasks, projects, users, canEdit, defaultProjectId,
  onUpdate, onOpen, onQuickAdd,
}: KanbanBoardProps) {
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const c of COLUMNS) map.set(c.value, []);
    for (const t of tasks) {
      const status = (COLUMNS.find((c) => c.value === t.status)?.value ?? "backlog") as TaskStatus;
      map.get(status)!.push(t);
    }
    return map;
  }, [tasks]);

  const handleDragStart = (e: DragStartEvent) => {
    const task = tasks.find((t) => t.id === e.active.id);
    if (task) setDraggingTask(task);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingTask(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    // O `over.id` pode ser um card (string ID de tarefa) ou uma coluna ("col:status")
    const overId = String(over.id);
    let targetStatus: TaskStatus | null = null;

    if (overId.startsWith("col:")) {
      targetStatus = overId.slice(4) as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetStatus = overTask.status as TaskStatus;
    }

    if (targetStatus && targetStatus !== task.status) {
      onUpdate({ ...task, status: targetStatus });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className="kanban-board"
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(280px, 1fr)",
          gap: 14,
          padding: "16px 24px 24px",
          overflowX: "auto",
          alignItems: "start",
          height: "100%",
        }}
      >
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.value}
            column={col}
            tasks={tasksByStatus.get(col.value) ?? []}
            projects={projects}
            users={users}
            canEdit={canEdit}
            onOpen={onOpen}
            onQuickAdd={defaultProjectId ? () => onQuickAdd(defaultProjectId, col.value) : undefined}
          />
        ))}
      </div>

      <DragOverlay>
        {draggingTask && (
          <div style={{ transform: "rotate(-2deg)", opacity: 0.95 }}>
            <CardBody task={draggingTask} project={projects.find((p) => p.id === draggingTask.projectId)} assignee={users.find((u) => u.id === draggingTask.assignedTo)} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── COLUMN ─────────────────────────────────────────────────────────────

function KanbanColumn({
  column, tasks, projects, users, canEdit, onOpen, onQuickAdd,
}: {
  column: typeof COLUMNS[number];
  tasks: Task[];
  projects: Project[];
  users: User[];
  canEdit: boolean;
  onOpen: (task: Task) => void;
  onQuickAdd?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.value}` });

  return (
    <section
      ref={setNodeRef}
      aria-label={`Coluna ${column.label}`}
      style={{
        background: isOver ? "var(--surface-hover)" : "var(--surface-2)",
        border: `1px solid ${isOver ? "var(--primary)" : "var(--border)"}`,
        borderTop: `3px solid ${column.color}`,
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        minHeight: 200,
        maxHeight: "calc(100vh - 220px)",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <header style={{
        padding: "12px 14px 8px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: column.color }} aria-hidden />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: 0.2 }}>
          {column.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", background: "var(--input-bg)", padding: "1px 8px", borderRadius: 999 }}>
          {tasks.length}
        </span>
        {canEdit && onQuickAdd && (
          <button
            onClick={onQuickAdd}
            aria-label={`Nova tarefa em ${column.label}`}
            title="Nova tarefa nesta coluna"
            style={{
              marginLeft: "auto",
              width: 24, height: 24, borderRadius: 6,
              background: "transparent", border: "none",
              color: "var(--text-secondary)", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            <Plus size={14} aria-hidden />
          </button>
        )}
      </header>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div style={{
          padding: "4px 10px 10px",
          display: "flex", flexDirection: "column", gap: 8,
          overflowY: "auto", flex: 1,
        }}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              project={projects.find((p) => p.id === task.projectId)}
              assignee={users.find((u) => u.id === task.assignedTo)}
              onOpen={() => onOpen(task)}
            />
          ))}
          {tasks.length === 0 && (
            <div style={{ padding: "28px 10px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
              {canEdit && onQuickAdd ? "Arraste uma tarefa pra cá ou clique em +" : "Nenhuma tarefa"}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

// ─── CARD ───────────────────────────────────────────────────────────────

function KanbanCard({
  task, project, assignee, onOpen,
}: {
  task: Task;
  project?: Project;
  assignee?: User;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardBody task={task} project={project} assignee={assignee} onClick={onOpen} />
    </div>
  );
}

function CardBody({
  task, project, assignee, onClick, dragging,
}: {
  task: Task;
  project?: Project;
  assignee?: User;
  onClick?: () => void;
  dragging?: boolean;
}) {
  const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";
  const priority = PRIORITY_LABELS[task.priority];

  return (
    <article
      onClick={(e) => {
        // só abre se NÃO foi um drag — pointer events que terminam sem mover
        if (e.detail === 0) return;
        onClick?.();
      }}
      style={{
        background: "var(--surface)",
        border: `1px solid var(--border)`,
        borderRadius: 10,
        padding: "10px 12px",
        cursor: "grab",
        boxShadow: dragging ? "0 12px 32px rgba(0,0,0,0.18)" : "0 1px 2px rgba(0,0,0,0.04)",
        userSelect: "none",
      }}
    >
      {/* Project pill */}
      {project && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: project.color }} aria-hidden />
          <span style={{ fontSize: 11, fontWeight: 600, color: project.color, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {project.icon} {project.name}
          </span>
        </div>
      )}

      {/* Title */}
      <h4 style={{
        margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)",
        lineHeight: 1.35,
        textDecoration: task.checked ? "line-through" : "none",
        opacity: task.checked ? 0.6 : 1,
      }}>
        {task.title}
      </h4>

      {/* Meta row */}
      <footer style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {priority && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 999,
            fontSize: 10, fontWeight: 700, color: priority.color,
            background: `color-mix(in srgb, ${priority.color} 14%, transparent)`,
            textTransform: "uppercase", letterSpacing: 0.4,
          }}>
            {priority.label}
          </span>
        )}
        {task.deadline && (
          <span style={{ fontSize: 11, color: overdue ? "var(--status-review)" : "var(--text-muted)", fontWeight: overdue ? 700 : 500 }}>
            {formatDate(task.deadline)}
          </span>
        )}
        {task.link && (
          <a
            href={task.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Abrir link"
            style={{ display: "inline-flex", alignItems: "center", color: "var(--primary)", textDecoration: "none" }}
          >
            <Link2 size={13} aria-hidden />
          </a>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          {task.checklist && task.checklist.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {task.checklist.filter((i) => i.done).length}/{task.checklist.length}
            </span>
          )}
          {assignee && (
            <span title={assignee.name} aria-label={assignee.name} style={{
              width: 24, height: 24, borderRadius: 999,
              background: "var(--primary-soft)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 13,
            }}>
              {assignee.avatar}
            </span>
          )}
        </span>
      </footer>
    </article>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
