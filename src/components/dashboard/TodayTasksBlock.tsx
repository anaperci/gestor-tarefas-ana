"use client";

import { CalendarCheck, Coffee } from "lucide-react";
import type { Project, Task, User } from "@/lib/types";
import { BlockCard } from "./BlockCard";
import { TaskListItem } from "./TaskListItem";

interface TodayTasksBlockProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  canEdit: boolean;
  onToggleDone: (task: Task) => void;
  onOpen: (task: Task) => void;
  delay?: number;
}

export function TodayTasksBlock({ tasks, projects, users, canEdit, onToggleDone, onOpen, delay }: TodayTasksBlockProps) {
  return (
    <BlockCard icon={CalendarCheck} iconColor="var(--primary)" title="Hoje" count={tasks.length} delay={delay}>
      {tasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <Coffee size={48} color="var(--text-muted)" style={{ opacity: 0.3, margin: "0 auto" }} aria-hidden />
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 12 }}>
            Nada pra hoje. Aproveite.
          </div>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {tasks.map((t) => (
            <TaskListItem
              key={t.id}
              task={t}
              projects={projects}
              users={users}
              showPriority
              canEdit={canEdit}
              onToggleDone={() => onToggleDone(t)}
              onClick={() => onOpen(t)}
            />
          ))}
        </ul>
      )}
    </BlockCard>
  );
}
