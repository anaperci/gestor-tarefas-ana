"use client";

import { UserCheck } from "lucide-react";
import { useMemo } from "react";
import type { Project, Task, User } from "@/lib/types";
import { BlockCard } from "./BlockCard";
import { TaskListItem } from "./TaskListItem";

interface DelegatedBlockProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  onOpen: (task: Task) => void;
  delay?: number;
}

export function DelegatedBlock({ tasks, projects, users, onOpen, delay }: DelegatedBlockProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.assignedTo ?? "?";
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([userId, list]) => ({
      user: users.find((u) => u.id === userId),
      tasks: list.slice(0, 3),
      hidden: Math.max(0, list.length - 3),
    }));
  }, [tasks, users]);

  if (tasks.length === 0) return null;

  return (
    <BlockCard icon={UserCheck} iconColor="var(--text-secondary)" title="Deleguei" count={tasks.length} delay={delay}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {grouped.map(({ user, tasks: userTasks, hidden }) => (
          <div key={user?.id ?? "?"}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
              textTransform: "uppercase", letterSpacing: 0.4,
              marginBottom: 6, paddingLeft: 6,
            }}>
              <span aria-hidden style={{ fontSize: 14 }}>{user?.avatar ?? "?"}</span>
              {user?.name ?? "Sem responsável"}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {userTasks.map((t) => (
                <TaskListItem key={t.id} task={t} projects={projects} users={users} showOverdue canEdit={false} onClick={() => onOpen(t)} />
              ))}
            </ul>
            {hidden > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 12, marginTop: 4 }}>
                + {hidden} outra{hidden > 1 ? "s" : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </BlockCard>
  );
}
