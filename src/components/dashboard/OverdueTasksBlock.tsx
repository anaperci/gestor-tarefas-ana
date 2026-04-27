"use client";

import { AlertTriangle } from "lucide-react";
import type { Project, Task, User } from "@/lib/types";
import { BlockCard } from "./BlockCard";
import { TaskListItem } from "./TaskListItem";

interface OverdueTasksBlockProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  canEdit: boolean;
  onToggleDone: (task: Task) => void;
  onOpen: (task: Task) => void;
  delay?: number;
}

export function OverdueTasksBlock({ tasks, projects, users, canEdit, onToggleDone, onOpen, delay }: OverdueTasksBlockProps) {
  if (tasks.length === 0) return null;

  return (
    <BlockCard
      icon={AlertTriangle}
      iconColor="var(--status-review)"
      title="Atrasadas"
      count={tasks.length}
      borderLeft="var(--status-review)"
      delay={delay}
    >
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {tasks.map((t) => (
          <TaskListItem
            key={t.id}
            task={t}
            projects={projects}
            users={users}
            showOverdue
            canEdit={canEdit}
            onToggleDone={() => onToggleDone(t)}
            onClick={() => onOpen(t)}
          />
        ))}
      </ul>
    </BlockCard>
  );
}
