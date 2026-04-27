"use client";

import { CheckCircle2, Eye } from "lucide-react";
import type { Project, Task, User } from "@/lib/types";
import { BlockCard } from "./BlockCard";
import { TaskListItem } from "./TaskListItem";

interface ReviewBlockProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  onOpen: (task: Task) => void;
  delay?: number;
}

export function ReviewBlock({ tasks, projects, users, onOpen, delay }: ReviewBlockProps) {
  return (
    <BlockCard icon={Eye} iconColor="var(--status-review)" title="Em revisão" count={tasks.length} delay={delay}>
      {tasks.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
          <CheckCircle2 size={18} aria-hidden /> Nada aguardando revisão.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {tasks.map((t) => (
            <TaskListItem
              key={t.id}
              task={t}
              projects={projects}
              users={users}
              showAssignee
              showReviewTime
              canEdit={false}
              onClick={() => onOpen(t)}
            />
          ))}
        </ul>
      )}
    </BlockCard>
  );
}
