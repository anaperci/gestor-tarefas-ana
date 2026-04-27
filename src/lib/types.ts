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
  projectId?: string;
  assignedTo?: string | null;
  link?: string;
  checked?: boolean;
  checklist?: { id?: string; text: string; done?: boolean }[];
  subtasks?: { id?: string; title: string; status?: string; checked?: boolean }[];
}
