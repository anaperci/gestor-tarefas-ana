import type {
  CreateProjectPayload,
  CreateTaskPayload,
  CreateUserPayload,
  Note,
  Project,
  Role,
  RoutineCheck,
  RoutineHistoryDay,
  RoutineItem,
  Tag,
  Task,
  UpdateTaskPayload,
  User,
} from "./types";

const API_BASE = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("taskhub-token");
}

function setToken(token: string) {
  localStorage.setItem("taskhub-token", token);
}

function clearToken() {
  localStorage.removeItem("taskhub-token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface LoginResponse {
  token: string;
  user: User;
}

interface MeResponse {
  user: User;
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<User> {
    const data = await request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    return data.user;
  },

  async me(): Promise<User> {
    const data = await request<MeResponse>("/auth/me");
    return data.user;
  },

  logout() {
    clearToken();
  },

  hasToken() {
    return !!getToken();
  },

  // Users
  getUsers: () => request<User[]>("/users"),
  createUser: (data: CreateUserPayload) =>
    request<User>("/users", { method: "POST", body: JSON.stringify(data) }),
  resetPassword: (id: string, password: string) =>
    request<{ success: boolean }>(`/users/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),
  changeOwnPassword: (id: string, currentPassword: string, password: string) =>
    request<{ success: boolean }>(`/users/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password, currentPassword }),
    }),
  updateProfile: (id: string, data: { name?: string }) =>
    request<{ success: boolean }>(`/users/${id}/profile`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  changeRole: (id: string, role: Role) =>
    request<{ success: boolean }>(`/users/${id}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  updateAvatar: (id: string, avatar: string) =>
    request<{ success: boolean; avatar: string }>(`/users/${id}/avatar`, {
      method: "PUT",
      body: JSON.stringify({ avatar }),
    }),
  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/users/${id}`, { method: "DELETE" }),

  // Projects
  getProjects: () => request<Project[]>("/projects"),
  createProject: (data: CreateProjectPayload) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    request<{ success: boolean }>(`/projects/${id}`, { method: "DELETE" }),
  updateShares: (id: string, sharedWith: string[]) =>
    request<{ success: boolean; sharedWith: string[] }>(`/projects/${id}/share`, {
      method: "PUT",
      body: JSON.stringify({ sharedWith }),
    }),

  // Tasks
  getTasks: () => request<Task[]>("/tasks"),
  createTask: (data: CreateTaskPayload) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: string, data: UpdateTaskPayload) =>
    request<Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (id: string) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: "DELETE" }),

  // Notes
  getNotes: () => request<Note[]>("/notes"),
  createNote: (data: { title?: string; content?: string }) =>
    request<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (id: string, data: { title?: string; content?: string; pinned?: boolean }) =>
    request<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNote: (id: string) =>
    request<{ success: boolean }>(`/notes/${id}`, { method: "DELETE" }),

  // Tags
  getTags: () => request<Tag[]>("/tags"),
  createTag: (data: { name: string; color?: string }) =>
    request<Tag>("/tags", { method: "POST", body: JSON.stringify(data) }),
  updateTag: (id: string, data: { name?: string; color?: string }) =>
    request<{ success: boolean }>(`/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTag: (id: string) =>
    request<{ success: boolean }>(`/tags/${id}`, { method: "DELETE" }),

  // Routines
  getRoutines: (date?: string) =>
    request<{ items: RoutineItem[]; checks: RoutineCheck[]; date: string }>(
      `/routines${date ? `?date=${date}` : ""}`
    ),
  createRoutineItem: (data: { title: string }) =>
    request<RoutineItem>("/routines", { method: "POST", body: JSON.stringify(data) }),
  updateRoutineItem: (
    id: string,
    data: { title?: string; sort_order?: number; active?: boolean }
  ) => request<RoutineItem>(`/routines/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRoutineItem: (id: string) =>
    request<{ success: boolean }>(`/routines/${id}`, { method: "DELETE" }),
  toggleRoutineCheck: (id: string, date?: string) =>
    request<{ checked: boolean; date: string }>(`/routines/${id}/check`, {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
  getRoutineHistory: (days: number = 7) =>
    request<{ history: RoutineHistoryDay[] }>(`/routines/history?days=${days}`),
};
