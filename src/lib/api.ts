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

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(username: string, password: string) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    return data.user;
  },

  async me() {
    const data = await request("/auth/me");
    return data.user;
  },

  logout() {
    clearToken();
  },

  hasToken() {
    return !!getToken();
  },

  // Users
  getUsers: () => request("/users"),
  createUser: (data: any) => request("/users", { method: "POST", body: JSON.stringify(data) }),
  resetPassword: (id: string, password: string) =>
    request(`/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) }),
  changeRole: (id: string, role: string) =>
    request(`/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
  deleteUser: (id: string) => request(`/users/${id}`, { method: "DELETE" }),

  // Projects
  getProjects: () => request("/projects"),
  createProject: (data: any) => request("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateShares: (id: string, sharedWith: string[]) =>
    request(`/projects/${id}/share`, { method: "PUT", body: JSON.stringify({ sharedWith }) }),

  // Tasks
  getTasks: () => request("/tasks"),
  createTask: (data: any) => request("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: string, data: any) =>
    request(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (id: string) => request(`/tasks/${id}`, { method: "DELETE" }),
};
