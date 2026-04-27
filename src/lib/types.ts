export type Role = "admin" | "editor" | "viewer";
export type TaskStatus = "backlog" | "todo" | "doing" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type SubtaskStatus = "todo" | "doing" | "done";

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  avatar: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  ownerId: string;
  sharedWith: string[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Subtask {
  id: string;
  title: string;
  status: SubtaskStatus | string;
  checked: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus | string;
  priority: TaskPriority | string;
  deadline: string;
  startDate: string;
  estimateHours: number | null;
  tagIds: string[];
  link: string;
  checked: boolean;
  projectId: string;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  checklist: ChecklistItem[];
  subtasks: Subtask[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineItem {
  id: string;
  userId: string;
  title: string;
  sort_order: number;
  active: boolean;
  createdAt: string;
}

export interface RoutineCheck {
  id: string;
  routineItemId: string;
  userId: string;
  checkDate: string;
  checkedAt: string;
}

export interface RoutineHistoryDay {
  date: string;
  completed: number;
  total: number;
}

// ─── Dashboard ─────────────────────────────────────────────────────────

export interface DashboardProjectSummary extends Project {
  open_count: number;
  done_count: number;
  total_count: number;
  last_activity: string | null;
}

export interface DashboardRoutine extends RoutineItem {
  checked: boolean;
}

export interface DashboardPayload {
  greeting: { name: string; period: "manhã" | "tarde" | "noite" };
  weekly_stats: { done: number; total: number };
  today_tasks: Task[];
  overdue_tasks: Task[];
  review_tasks: Task[];
  delegated_tasks: Task[];
  active_projects: DashboardProjectSummary[];
  today_routines: DashboardRoutine[];
  recent_notes: Note[];
  meta: { fetched_at: string; user_id: string; role: Role };
}

// ─── API payloads ──────────────────────────────────────────────────────

export interface CreateUserPayload {
  username: string;
  name?: string;
  password: string;
  role: Role;
}

export interface CreateProjectPayload {
  name: string;
  color?: string;
  icon?: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string;
  projectId: string;
  assignedTo?: string;
  link?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus | string;
  priority?: TaskPriority | string;
  deadline?: string;
  startDate?: string;
  estimateHours?: number | null;
  tagIds?: string[];
  projectId?: string;
  assignedTo?: string | null;
  link?: string;
  checked?: boolean;
  checklist?: { id?: string; text: string; done?: boolean }[];
  subtasks?: { id?: string; title: string; status?: string; checked?: boolean }[];
}
