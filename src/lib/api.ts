import type {
  AppNotification,
  ContentComment,
  ContentItem,
  ContentSlide,
  CreateContentItemPayload,
  CreateProjectPayload,
  CreateTaskPayload,
  CreateUserPayload,
  CreateWorkspacePayload,
  Note,
  Project,
  Role,
  Workspace,
  RoutineCheck,
  RoutineHistoryDay,
  RoutineItem,
  Tag,
  Task,
  TaskAttachment,
  TaskComment,
  UpdateContentItemPayload,
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

  // Reset de senha
  forgotPassword: (identifier: string) =>
    request<{ success: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),
  resetPasswordWithToken: (token: string, password: string) =>
    request<{ success: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  sendResetEmail: (id: string) =>
    request<{ success: boolean }>(`/users/${id}/reset-email`, { method: "POST" }),

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
  moveProject: (id: string, workspaceId: string) =>
    request<{ success: boolean; workspaceId: string }>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ workspaceId }),
    }),

  // Workspaces
  getWorkspaces: () => request<Workspace[]>("/workspaces"),
  createWorkspace: (data: CreateWorkspacePayload) =>
    request<Workspace>("/workspaces", { method: "POST", body: JSON.stringify(data) }),
  updateWorkspace: (id: string, data: { name?: string; color?: string; icon?: string }) =>
    request<{ success: boolean }>(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteWorkspace: (id: string) =>
    request<{ success: boolean }>(`/workspaces/${id}`, { method: "DELETE" }),
  setWorkspaceMembers: (id: string, members: string[]) =>
    request<{ success: boolean; members: string[] }>(`/workspaces/${id}/members`, {
      method: "PUT",
      body: JSON.stringify({ members }),
    }),

  // Tasks
  getTasks: () => request<Task[]>("/tasks"),
  createTask: (data: CreateTaskPayload) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: string, data: UpdateTaskPayload) =>
    request<Task>(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (id: string) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: "DELETE" }),
  getTaskComments: (id: string) => request<TaskComment[]>(`/tasks/${id}/comments`),
  addTaskComment: (id: string, body: string) =>
    request<TaskComment>(`/tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  notifyMention: (taskId: string, userId: string) =>
    request<{ success: boolean }>(`/tasks/${taskId}/mention`, { method: "POST", body: JSON.stringify({ userId }) }),

  // Notificações internas
  getNotifications: () => request<{ items: AppNotification[]; unread: number }>("/notifications"),
  markNotificationsRead: (ids?: string[]) =>
    request<{ success: boolean }>("/notifications/read", {
      method: "POST",
      body: JSON.stringify(ids && ids.length ? { ids } : {}),
    }),

  // Anexos de tarefa
  getTaskAttachments: (taskId: string) =>
    request<TaskAttachment[]>(`/tasks/${taskId}/attachments`),
  uploadTaskAttachment: async (taskId: string, file: File): Promise<TaskAttachment> => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro ao enviar" }));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<TaskAttachment>;
  },
  getAttachmentUrl: (id: string) =>
    request<{ url: string; fileName: string }>(`/attachments/${id}`),
  deleteAttachment: (id: string) =>
    request<{ success: boolean }>(`/attachments/${id}`, { method: "DELETE" }),

  // Notes
  getNotes: () => request<Note[]>("/notes"),
  createNote: (data: { title?: string; content?: string }) =>
    request<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (id: string, data: { title?: string; content?: string; pinned?: boolean }) =>
    request<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNote: (id: string) =>
    request<{ success: boolean }>(`/notes/${id}`, { method: "DELETE" }),

  // Content
  getContentItems: (params: {
    status?: string[];
    format?: string[];
    platform?: string;
    assignedTo?: string;
    workspaceId?: string;
    search?: string;
  } = {}) => {
    const search = new URLSearchParams();
    (params.status ?? []).forEach((s) => search.append("status", s));
    (params.format ?? []).forEach((f) => search.append("format", f));
    if (params.platform) search.set("platform", params.platform);
    if (params.assignedTo) search.set("assignedTo", params.assignedTo);
    if (params.workspaceId) search.set("workspaceId", params.workspaceId);
    if (params.search) search.set("search", params.search);
    const qs = search.toString();
    return request<ContentItem[]>(`/content${qs ? `?${qs}` : ""}`);
  },
  createContentItem: (data: CreateContentItemPayload = {}) =>
    request<ContentItem>("/content", { method: "POST", body: JSON.stringify(data) }),
  getContentItem: (id: string) => request<ContentItem>(`/content/${id}`),
  updateContentItem: (id: string, data: UpdateContentItemPayload) =>
    request<ContentItem>(`/content/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContentItem: (id: string) =>
    request<{ success: boolean }>(`/content/${id}`, { method: "DELETE" }),

  getContentSlides: (id: string) => request<ContentSlide[]>(`/content/${id}/slides`),
  createContentSlide: (id: string, data: { title?: string; body?: string; notes?: string } = {}) =>
    request<ContentSlide>(`/content/${id}/slides`, { method: "POST", body: JSON.stringify(data) }),
  updateContentSlide: (slideId: string, data: { title?: string; body?: string; notes?: string }) =>
    request<{ success: boolean }>(`/content/slides/${slideId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContentSlide: (slideId: string) =>
    request<{ success: boolean }>(`/content/slides/${slideId}`, { method: "DELETE" }),
  reorderContentSlides: (ids: string[]) =>
    request<{ success: boolean }>(`/content/slides/reorder`, { method: "POST", body: JSON.stringify({ ids }) }),

  getContentComments: (id: string) => request<ContentComment[]>(`/content/${id}/comments`),
  createContentComment: (id: string, body: string) =>
    request<ContentComment>(`/content/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  updateContentComment: (commentId: string, body: string) =>
    request<{ success: boolean }>(`/content/comments/${commentId}`, { method: "PUT", body: JSON.stringify({ body }) }),
  deleteContentComment: (commentId: string) =>
    request<{ success: boolean }>(`/content/comments/${commentId}`, { method: "DELETE" }),

  transformContentToTask: (id: string, projectId?: string) =>
    request<{ taskId: string; alreadyLinked: boolean }>(`/content/${id}/transform-to-task`, {
      method: "POST",
      body: JSON.stringify(projectId ? { projectId } : {}),
    }),

  setUserContentAccess: (userId: string, canAccessContent: boolean) =>
    request<{ success: boolean; canAccessContent: boolean }>(`/users/${userId}/content-access`, {
      method: "PUT",
      body: JSON.stringify({ canAccessContent }),
    }),

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
