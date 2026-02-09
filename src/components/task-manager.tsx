"use client";

import { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback, CSSProperties, ReactNode } from "react";
import { api } from "@/lib/api";

// ——— Demo Data ———
function hashPassword(pwd: string) {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

interface User {
  id: string;
  username: string;
  name: string;
  passwordHash: string;
  role: "admin" | "editor" | "viewer";
  avatar: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  ownerId: string;
  sharedWith: string[];
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface Subtask {
  id: string;
  title: string;
  status: string;
  checked: boolean;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string;
  projectId: string;
  link: string;
  checked: boolean;
  description: string;
  assignedTo: string;
  createdBy: string;
  checklist: ChecklistItem[];
  subtasks: Subtask[];
}

interface Group {
  id: string;
  name: string;
  color: string;
  icon: string;
  tasks: Task[];
}

const DEMO_USERS: User[] = [
  { id: "user-1", username: "anapaula", name: "Ana Paula", passwordHash: hashPassword("padrao@890"), role: "admin", avatar: "👑" },
];

const ROLES: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  admin: { label: "Admin", color: "#E2445C", icon: "👑", desc: "Acesso total. Cria usuários, projetos, gerencia tudo." },
  editor: { label: "Editor", color: "#FDAB3D", icon: "✏️", desc: "Cria e edita tarefas nos projetos compartilhados." },
  viewer: { label: "Visualizador", color: "#579BFC", icon: "👁️", desc: "Apenas visualiza tarefas e projetos compartilhados." },
};

const INITIAL_PROJECTS: Project[] = [
  { id: "proj-1", name: "PERCI", color: "#7B61FF", icon: "🚀", ownerId: "user-1", sharedWith: [] },
  { id: "proj-2", name: "NexIA Lab", color: "#00C875", icon: "🤖", ownerId: "user-1", sharedWith: [] },
  { id: "proj-3", name: "Imersão 10K", color: "#FF6B6B", icon: "🔥", ownerId: "user-1", sharedWith: [] },
];

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog", color: "#A0A0A0" },
  { value: "todo", label: "A Fazer", color: "#579BFC" },
  { value: "doing", label: "Em Progresso", color: "#FDAB3D" },
  { value: "review", label: "Revisão", color: "#E2445C" },
  { value: "done", label: "Concluído", color: "#00C875" },
];

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Crítica", bg: "#E2445C" },
  { value: "high", label: "Alta", bg: "#FDAB3D" },
  { value: "medium", label: "Média", bg: "#579BFC" },
  { value: "low", label: "Baixa", bg: "#A0A0A0" },
];

const genId = () => Math.random().toString(36).slice(2, 10);

const GRID_COLUMNS = "36px 1fr 130px 130px 110px 100px 60px 60px";
const GRID_COLUMNS_SUBTASK = "36px 1fr 130px 110px 60px";

const INITIAL_TASKS: Task[] = [
  {
    id: genId(), title: "Gravar vídeo de vendas Imersão 10K", status: "doing", priority: "critical",
    deadline: "2026-02-15", projectId: "proj-3", link: "", checked: false,
    description: "Gravar o vídeo principal de vendas para a página da Imersão 10K com IA.",
    assignedTo: "user-1", createdBy: "user-1",
    checklist: [
      { id: genId(), text: "Escrever roteiro", done: true },
      { id: genId(), text: "Preparar setup", done: false },
      { id: genId(), text: "Gravar", done: false },
    ],
    subtasks: [
      { id: genId(), title: "Criar thumbnail", status: "todo", checked: false },
      { id: genId(), title: "Configurar checkout", status: "doing", checked: false },
    ],
  },
  {
    id: genId(), title: "Montar knowledge base NexIA", status: "todo", priority: "high",
    deadline: "2026-02-20", projectId: "proj-2", link: "https://nexia.com.br", checked: false,
    description: "", assignedTo: "user-1", createdBy: "user-1", checklist: [], subtasks: [],
  },
  {
    id: genId(), title: "Criar prompt de copywriting avançado", status: "backlog", priority: "medium",
    deadline: "2026-02-28", projectId: "proj-1", link: "", checked: false,
    description: "", assignedTo: "user-1", createdBy: "user-1", checklist: [], subtasks: [],
  },
  {
    id: genId(), title: "Preparar deck governo", status: "todo", priority: "high",
    deadline: "2026-03-05", projectId: "proj-2", link: "", checked: false,
    description: "Deck institucional NexIA Lab.", assignedTo: "user-1", createdBy: "user-1",
    checklist: [{ id: genId(), text: "Levantar cases", done: false }],
    subtasks: [{ id: genId(), title: "Revisar dados de ROI", status: "todo", checked: false }],
  },
];

// ——— Theme ———
interface Theme {
  bg: string; sidebar: string; surface: string; surfaceHover: string;
  border: string; borderStrong: string; text: string; textSecondary: string; textMuted: string;
  inputBg: string; inputBorder: string; dropdownBg: string; dropdownHover: string;
  badgeBg: (c: string) => string; badgeBorder: (c: string) => string;
  scrollThumb: string; overlay: string; scheme: string;
  loginBg: string; cardBg: string; cardBorder: string;
}

const themes: Record<string, Theme> = {
  dark: {
    bg: "#0F1021", sidebar: "#13142A", surface: "#1A1B2E", surfaceHover: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.04)", borderStrong: "rgba(255,255,255,0.06)",
    text: "#EDF2F4", textSecondary: "#8D99AE", textMuted: "#555",
    inputBg: "rgba(255,255,255,0.04)", inputBorder: "rgba(255,255,255,0.08)",
    dropdownBg: "#2B2D42", dropdownHover: "rgba(255,255,255,0.1)",
    badgeBg: (c: string) => c + "22", badgeBorder: (c: string) => c + "44",
    scrollThumb: "rgba(255,255,255,0.1)", overlay: "rgba(0,0,0,0.5)", scheme: "dark",
    loginBg: "linear-gradient(135deg, #0F1021 0%, #1A1B2E 50%, #13142A 100%)",
    cardBg: "#1A1B2E", cardBorder: "rgba(255,255,255,0.06)",
  },
  light: {
    bg: "#FFFFFF", sidebar: "#FFFFFF", surface: "#FFFFFF", surfaceHover: "rgba(0,0,0,0.02)",
    border: "rgba(0,0,0,0.06)", borderStrong: "rgba(0,0,0,0.09)",
    text: "#1A1D2E", textSecondary: "#5A6178", textMuted: "#9CA3B8",
    inputBg: "rgba(0,0,0,0.03)", inputBorder: "rgba(0,0,0,0.1)",
    dropdownBg: "#FFFFFF", dropdownHover: "rgba(0,0,0,0.04)",
    badgeBg: (c: string) => c + "15", badgeBorder: (c: string) => c + "30",
    scrollThumb: "rgba(0,0,0,0.12)", overlay: "rgba(0,0,0,0.25)", scheme: "light",
    loginBg: "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 50%, #FFFFFF 100%)",
    cardBg: "#FFFFFF", cardBorder: "rgba(0,0,0,0.08)",
  },
};

// ——— Dropdown ———
function Dropdown({ options, value, onChange, renderOption, theme, disabled }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o: any) => o.value === value) || options[0];

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen(!open); }}
        style={{ background: "none", border: "none", padding: 0, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
        {renderOption ? renderOption(selected, true) : selected.label}
      </button>
      {open && !disabled && (
        <div style={{
          position: "absolute", top: "110%", left: 0, zIndex: 999,
          background: theme.dropdownBg, borderRadius: 10, padding: 4, minWidth: 155,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: `1px solid ${theme.border}`
        }}>
          {options.map((opt: any) => (
            <button key={opt.value} onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
              style={{
                display: "block", width: "100%", padding: "8px 12px", border: "none",
                background: opt.value === value ? theme.dropdownHover : "transparent",
                color: theme.text, borderRadius: 7, cursor: "pointer", textAlign: "left", fontSize: 13,
                fontFamily: "'Figtree', sans-serif"
              }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.background = theme.dropdownHover}
              onMouseLeave={(e) => (e.target as HTMLElement).style.background = opt.value === value ? theme.dropdownHover : "transparent"}>
              {renderOption ? renderOption(opt, false) : opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ value, onChange, compact, theme, disabled }: any) {
  return (
    <Dropdown options={STATUS_OPTIONS} value={value} onChange={onChange} theme={theme} disabled={disabled}
      renderOption={(o: any) => (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: theme.badgeBg(o.color), color: o.color, borderRadius: 20,
          padding: compact ? "3px 10px" : "4px 14px", fontSize: compact ? 12 : 13,
          fontWeight: 600, border: `1px solid ${theme.badgeBorder(o.color)}`, whiteSpace: "nowrap"
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: o.color }} />
          {o.label}
        </span>
      )}
    />
  );
}

function PriorityBadge({ value, onChange, theme, disabled }: any) {
  return (
    <Dropdown options={PRIORITY_OPTIONS} value={value} onChange={onChange} theme={theme} disabled={disabled}
      renderOption={(o: any) => (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: theme.badgeBg(o.bg), color: o.bg, borderRadius: 20,
          padding: "4px 14px", fontSize: 13, fontWeight: 600,
          border: `1px solid ${theme.badgeBorder(o.bg)}`, whiteSpace: "nowrap"
        }}>{o.label}</span>
      )}
    />
  );
}

// ——— Checklist ———
function Checklist({ items, onChange, theme, disabled }: any) {
  const [newItem, setNewItem] = useState("");
  const done = items.filter((i: ChecklistItem) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const toggle = (id: string) => { if (!disabled) onChange(items.map((i: ChecklistItem) => (i.id === id ? { ...i, done: !i.done } : i))); };
  const remove = (id: string) => { if (!disabled) onChange(items.filter((i: ChecklistItem) => i.id !== id)); };
  const add = () => { if (!newItem.trim() || disabled) return; onChange([...items, { id: genId(), text: newItem.trim(), done: false }]); setNewItem(""); };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 600 }}>Checklist</span>
        <span style={{ fontSize: 11, color: theme.textMuted }}>{done}/{items.length}</span>
        <div style={{ flex: 1, height: 4, borderRadius: 4, background: theme.inputBg }}>
          <div style={{ width: pct + "%", height: "100%", borderRadius: 4, background: "#00C875", transition: "width 0.3s" }} />
        </div>
      </div>
      {items.map((item: ChecklistItem) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${theme.border}` }}>
          <button onClick={() => toggle(item.id)} style={{
            width: 18, height: 18, borderRadius: 4, border: `2px solid ${item.done ? "#00C875" : theme.textMuted}`,
            background: item.done ? "#00C875" : "transparent", cursor: disabled ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0
          }}>{item.done && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}</button>
          <span style={{ flex: 1, fontSize: 13, color: item.done ? theme.textMuted : theme.text, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
          {!disabled && <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14, padding: "0 4px", opacity: 0.6 }}>×</button>}
        </div>
      ))}
      {!disabled && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Adicionar item..."
            style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "6px 10px", color: theme.text, fontSize: 13, outline: "none", fontFamily: "'Figtree', sans-serif" }} />
          <button onClick={add} style={{ background: "#7B61FF", border: "none", borderRadius: 6, color: "#fff", padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>+</button>
        </div>
      )}
    </div>
  );
}

// ——— Login Screen ———
function LoginScreen({ users, onLogin, theme, onToggleTheme, useApi }: any) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleLogin = async () => {
    if (useApi) {
      try {
        const user = await api.login(username.toLowerCase().trim(), password);
        onLogin(user);
        return;
      } catch (e: any) { triggerError(e.message || "Erro no login"); return; }
    }
    const user = users.find((u: User) => u.username === username.toLowerCase().trim());
    if (!user) { triggerError("Usuário não encontrado"); return; }
    if (user.passwordHash !== hashPassword(password)) { triggerError("Senha incorreta"); return; }
    onLogin(user);
  };

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: theme.loginBg, fontFamily: "'Figtree', sans-serif", padding: 20,
      position: "relative"
    }}>
      <button onClick={onToggleTheme} style={{
        position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: 12,
        border: `1px solid ${theme.border}`, background: theme.inputBg, cursor: "pointer",
        fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text
      }}>
        {theme.scheme === "dark" ? "☀️" : "🌙"}
      </button>

      <div style={{ position: "absolute", top: "10%", left: "5%", width: 300, height: 300, borderRadius: "50%", background: "rgba(123,97,255,0.04)", filter: "blur(80px)" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 250, height: 250, borderRadius: "50%", background: "rgba(87,155,252,0.04)", filter: "blur(60px)" }} />

      <div style={{
        width: 400, padding: "48px 40px", borderRadius: 24,
        background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
        boxShadow: theme.scheme === "dark" ? "0 20px 60px rgba(0,0,0,0.4)" : "0 20px 60px rgba(0,0,0,0.08)",
        animation: shake ? "shakeX 0.4s" : "fadeUp 0.5s ease-out",
        position: "relative", zIndex: 1
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300..900&family=Poppins:wght@600;700;800;900&display=swap');
          @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes fadeUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes shakeX { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        `}</style>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #7B61FF, #579BFC)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, color: "#fff", boxShadow: "0 8px 24px rgba(123,97,255,0.3)"
          }}>✦</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: -0.5, margin: 0, fontFamily: "'Poppins', sans-serif" }}>Task Hub</h1>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>Faça login para continuar</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.3 }}>Usuário</label>
          <input
            value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="seu.usuario"
            autoFocus
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              background: theme.inputBg, border: `1.5px solid ${error ? "#E2445C" : theme.inputBorder}`,
              color: theme.text, fontSize: 14, outline: "none", fontFamily: "'Figtree', sans-serif",
              transition: "border-color 0.2s"
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.3 }}>Senha</label>
          <input
            type="password"
            value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="••••••••"
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              background: theme.inputBg, border: `1.5px solid ${error ? "#E2445C" : theme.inputBorder}`,
              color: theme.text, fontSize: 14, outline: "none", fontFamily: "'Figtree', sans-serif",
              transition: "border-color 0.2s"
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: "rgba(226,68,92,0.1)", border: "1px solid rgba(226,68,92,0.2)",
            color: "#E2445C", fontSize: 13, fontWeight: 500, textAlign: "center"
          }}>{error}</div>
        )}

        <button onClick={handleLogin} style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #7B61FF, #579BFC)", color: "#fff",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(123,97,255,0.35)",
          transition: "transform 0.15s, box-shadow 0.15s"
        }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "translateY(-1px)"; (e.target as HTMLElement).style.boxShadow = "0 6px 20px rgba(123,97,255,0.45)"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "translateY(0)"; (e.target as HTMLElement).style.boxShadow = "0 4px 16px rgba(123,97,255,0.35)"; }}>
          Entrar
        </button>

        <div style={{ marginTop: 28, padding: "16px", borderRadius: 12, background: theme.inputBg, border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Credenciais de acesso</div>
          <button onClick={() => { setUsername("anapaula"); setPassword("padrao@890"); setError(""); }}
            style={{
              display: "flex", justifyContent: "space-between", width: "100%", padding: "8px 10px",
              background: "transparent", border: "none", color: theme.textSecondary,
              fontSize: 13, cursor: "pointer", borderRadius: 6, fontFamily: "'Figtree', sans-serif"
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.background = theme.dropdownHover}
            onMouseLeave={(e) => (e.target as HTMLElement).style.background = "transparent"}>
            <span><b style={{ color: theme.text }}>anapaula</b> / padrao@890</span>
            <span>Admin 👑</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ——— Admin Panel ———
function AdminPanel({ users, projects, tasks, onUpdateUsers, onUpdateProjects, onClose, theme, currentUser }: any) {
  const [tab, setTab] = useState("users");
  const [newUser, setNewUser] = useState({ username: "", name: "", password: "", role: "editor" });

  const addUser = () => {
    if (!newUser.username.trim() || !newUser.password.trim()) return;
    if (users.find((u: User) => u.username === newUser.username.toLowerCase().trim())) return;
    const avatars: Record<string, string> = { admin: "👑", editor: "✏️", viewer: "👁️" };
    onUpdateUsers([...users, {
      id: "user-" + genId(), username: newUser.username.toLowerCase().trim(),
      name: newUser.name || newUser.username, passwordHash: hashPassword(newUser.password),
      role: newUser.role, avatar: avatars[newUser.role]
    }]);
    setNewUser({ username: "", name: "", password: "", role: "editor" });
  };

  const resetPassword = (userId: string, newPwd: string) => {
    onUpdateUsers(users.map((u: User) => u.id === userId ? { ...u, passwordHash: hashPassword(newPwd) } : u));
  };

  const deleteUser = (userId: string) => {
    if (userId === currentUser.id) return;
    if (!window.confirm("Deletar este usuário?")) return;
    onUpdateUsers(users.filter((u: User) => u.id !== userId));
  };

  const changeRole = (userId: string, newRole: string) => {
    const avatars: Record<string, string> = { admin: "👑", editor: "✏️", viewer: "👁️" };
    onUpdateUsers(users.map((u: User) => u.id === userId ? { ...u, role: newRole as User["role"], avatar: avatars[newRole] } : u));
  };

  const toggleShare = (projId: string, userId: string) => {
    onUpdateProjects(projects.map((p: Project) => {
      if (p.id !== projId) return p;
      const shared = p.sharedWith || [];
      return { ...p, sharedWith: shared.includes(userId) ? shared.filter((id: string) => id !== userId) : [...shared, userId] };
    }));
  };

  const inputStyle: CSSProperties = {
    background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
    padding: "8px 12px", color: theme.text, fontSize: 13, outline: "none", fontFamily: "'Figtree', sans-serif"
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: theme.overlay, backdropFilter: "blur(6px)" }} />
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "relative", width: "min(720px, 94vw)", maxHeight: "85vh",
        background: theme.surface, borderRadius: 20, overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)", animation: "fadeUp 0.25s ease-out",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text, margin: 0, letterSpacing: -0.3 }}>⚙️ Painel Admin</h2>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Gerenciar usuários e permissões</p>
          </div>
          <button onClick={onClose} style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: `1px solid ${theme.border}` }}>
          {[{ key: "users", label: "👥 Usuários" }, { key: "permissions", label: "🔐 Permissões" }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 20px", border: "none", borderBottom: tab === t.key ? "2px solid #7B61FF" : "2px solid transparent",
              background: "transparent", color: tab === t.key ? "#7B61FF" : theme.textSecondary,
              fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Figtree', sans-serif",
              transition: "all 0.15s", marginBottom: -1
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ padding: "20px 28px 28px", overflowY: "auto", flex: 1 }}>
          {tab === "users" && (
            <>
              <div style={{ padding: 16, borderRadius: 12, background: theme.inputBg, border: `1px solid ${theme.border}`, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 12 }}>Criar novo usuário</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Usuário</div>
                    <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="usuario" style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Nome</div>
                    <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nome Completo" style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Senha</div>
                    <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="senha123" style={{ ...inputStyle, width: "100%" }} />
                  </div>
                  <div>
                    <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      style={{ ...inputStyle, cursor: "pointer", colorScheme: theme.scheme, padding: "8px 8px" }}>
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                    </select>
                  </div>
                  <button onClick={addUser} style={{
                    background: "#7B61FF", border: "none", color: "#fff", borderRadius: 8,
                    padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
                  }}>+ Criar</button>
                </div>
              </div>

              {users.map((user: User) => (
                <UserRow key={user.id} user={user} currentUser={currentUser} theme={theme}
                  onResetPassword={(pwd: string) => resetPassword(user.id, pwd)}
                  onChangeRole={(r: string) => changeRole(user.id, r)}
                  onDelete={() => deleteUser(user.id)} />
              ))}
            </>
          )}

          {tab === "permissions" && (
            <>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                Marque os usuários que terão acesso a cada projeto. Admins sempre têm acesso total.
              </div>
              {projects.map((proj: Project) => (
                <div key={proj.id} style={{
                  padding: 16, borderRadius: 12, border: `1px solid ${theme.border}`,
                  marginBottom: 10, background: theme.inputBg
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>{proj.icon}</span>
                    <span style={{ fontWeight: 700, color: proj.color, fontSize: 15 }}>{proj.name}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {users.filter((u: User) => u.role !== "admin").map((user: User) => {
                      const isShared = (proj.sharedWith || []).includes(user.id);
                      return (
                        <button key={user.id} onClick={() => toggleShare(proj.id, user.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                            borderRadius: 20, border: `1.5px solid ${isShared ? "#00C875" : theme.border}`,
                            background: isShared ? "rgba(0,200,117,0.1)" : "transparent",
                            color: isShared ? "#00C875" : theme.textMuted,
                            cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Figtree', sans-serif",
                            transition: "all 0.15s"
                          }}>
                          <span style={{ fontSize: 14 }}>{isShared ? "✓" : "+"}</span>
                          {user.avatar} {user.name}
                          <span style={{ fontSize: 10, opacity: 0.7 }}>({ROLES[user.role].label})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: theme.inputBg, border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, marginBottom: 10 }}>Legenda de Permissões</div>
                {Object.entries(ROLES).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: theme.badgeBg(v.color), color: v.color, borderRadius: 12,
                      padding: "3px 10px", fontSize: 11, fontWeight: 600, border: `1px solid ${theme.badgeBorder(v.color)}`
                    }}>{v.icon} {v.label}</span>
                    <span style={{ fontSize: 12, color: theme.textSecondary }}>{v.desc}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ——— User Row in Admin ———
function UserRow({ user, currentUser, theme, onResetPassword, onChangeRole, onDelete }: any) {
  const [showReset, setShowReset] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const isMe = user.id === currentUser.id;
  const role = ROLES[user.role];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      borderRadius: 12, border: `1px solid ${theme.border}`, marginBottom: 6,
      background: isMe ? theme.badgeBg("#7B61FF") : "transparent"
    }}>
      <span style={{ fontSize: 24 }}>{user.avatar}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
          {user.name} {isMe && <span style={{ fontSize: 10, color: "#7B61FF" }}>(você)</span>}
        </div>
        <div style={{ fontSize: 12, color: theme.textMuted }}>@{user.username}</div>
      </div>

      <select value={user.role} onChange={(e) => onChangeRole(e.target.value)} disabled={isMe}
        style={{
          background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
          padding: "5px 8px", color: role.color, fontSize: 12, fontWeight: 600, outline: "none",
          cursor: isMe ? "default" : "pointer", colorScheme: theme.scheme, fontFamily: "'Figtree', sans-serif"
        }}>
        {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
      </select>

      {showReset ? (
        <div style={{ display: "flex", gap: 4 }}>
          <input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Nova senha"
            style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "5px 8px", color: theme.text, fontSize: 12, outline: "none", width: 120, fontFamily: "'Figtree', sans-serif" }} />
          <button onClick={() => { if (newPwd.trim()) { onResetPassword(newPwd); setShowReset(false); setNewPwd(""); } }}
            style={{ background: "#00C875", border: "none", color: "#fff", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✓</button>
          <button onClick={() => setShowReset(false)}
            style={{ background: theme.inputBg, border: "none", color: theme.textMuted, borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setShowReset(true)}
          style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "5px 12px", color: theme.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "'Figtree', sans-serif" }}>
          🔑 Reset
        </button>
      )}

      {!isMe && (
        <button onClick={onDelete}
          style={{ background: "rgba(226,68,92,0.1)", border: "1px solid rgba(226,68,92,0.2)", borderRadius: 8, padding: "5px 10px", color: "#E2445C", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
          🗑️
        </button>
      )}
    </div>
  );
}

// ——— Task Detail ———
function TaskDetail({ task, projects, users, onUpdate, onClose, theme, canEdit }: any) {
  const project = projects.find((p: Project) => p.id === task.projectId);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: theme.overlay, backdropFilter: "blur(4px)" }} />
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "relative", width: "min(580px, 92vw)", height: "100%",
        background: theme.surface, overflowY: "auto", padding: "32px 28px",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.12)", animation: "slideIn 0.25s ease-out"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            {project && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: project.color, fontWeight: 600, background: theme.badgeBg(project.color), padding: "3px 10px", borderRadius: 12, marginBottom: 10 }}>
                {project.icon} {project.name}
              </span>
            )}
            <input value={task.title} onChange={(e) => canEdit && onUpdate({ ...task, title: e.target.value })} readOnly={!canEdit}
              style={{ display: "block", width: "100%", background: "transparent", border: "none", color: theme.text, fontSize: 22, fontWeight: 700, outline: "none", fontFamily: "'Figtree', sans-serif", padding: 0, marginTop: 6, cursor: canEdit ? "text" : "default" }} />
          </div>
          <button onClick={onClose} style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        {!canEdit && (
          <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(87,155,252,0.1)", border: "1px solid rgba(87,155,252,0.2)", color: "#579BFC", fontSize: 12, fontWeight: 500, marginBottom: 20 }}>
            👁️ Modo visualização — você não tem permissão para editar
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28, padding: 16, background: theme.inputBg, borderRadius: 12, border: `1px solid ${theme.border}` }}>
          <div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Status</div>
            <StatusBadge value={task.status} onChange={(v: string) => onUpdate({ ...task, status: v })} theme={theme} disabled={!canEdit} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Prioridade</div>
            <PriorityBadge value={task.priority} onChange={(v: string) => onUpdate({ ...task, priority: v })} theme={theme} disabled={!canEdit} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Prazo</div>
            <input type="date" value={task.deadline || ""} readOnly={!canEdit} onChange={(e) => canEdit && onUpdate({ ...task, deadline: e.target.value })}
              style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "5px 10px", color: theme.text, fontSize: 13, outline: "none", colorScheme: theme.scheme, fontFamily: "'Figtree', sans-serif" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Responsável</div>
            {canEdit ? (
              <Dropdown
                options={users.map((u: User) => ({ value: u.id, label: u.name, ...u }))}
                value={task.assignedTo || ""} onChange={(v: string) => onUpdate({ ...task, assignedTo: v })} theme={theme}
                renderOption={(o: any) => <span style={{ fontSize: 12, color: theme.text }}>{o.avatar} {o.label || o.name}</span>}
              />
            ) : (
              <span style={{ fontSize: 12, color: theme.text }}>
                {(() => { const u = users.find((u: User) => u.id === task.assignedTo); return u ? `${u.avatar} ${u.name}` : "—"; })()}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Link</div>
          {canEdit ? (
            <input value={task.link || ""} onChange={(e) => onUpdate({ ...task, link: e.target.value })} placeholder="https://..."
              style={{ width: "100%", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "8px 12px", color: "#579BFC", fontSize: 13, outline: "none", fontFamily: "'Figtree', sans-serif" }} />
          ) : task.link ? (
            <a href={task.link} target="_blank" rel="noopener noreferrer" style={{ color: "#579BFC", fontSize: 13 }}>{task.link}</a>
          ) : <span style={{ color: theme.textMuted, fontSize: 13 }}>—</span>}
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 600, marginBottom: 8 }}>Descrição</div>
          <textarea value={task.description || ""} readOnly={!canEdit} onChange={(e) => canEdit && onUpdate({ ...task, description: e.target.value })}
            placeholder={canEdit ? "Adicione uma descrição detalhada..." : "Sem descrição"}
            rows={4}
            style={{ width: "100%", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "12px 14px", color: theme.text, fontSize: 14, outline: "none", resize: canEdit ? "vertical" : "none", lineHeight: 1.6, fontFamily: "'Figtree', sans-serif" }} />
        </div>

        <div style={{ marginBottom: 28 }}>
          <Checklist items={task.checklist || []} onChange={(items: ChecklistItem[]) => canEdit && onUpdate({ ...task, checklist: items })} theme={theme} disabled={!canEdit} />
        </div>

        <div>
          <div style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 600, marginBottom: 10 }}>Subtarefas</div>
          {(task.subtasks || []).map((st: Subtask, i: number) => (
            <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: theme.inputBg, borderRadius: 8, marginBottom: 4, border: `1px solid ${theme.border}` }}>
              <button onClick={() => { if (!canEdit) return; const n = [...task.subtasks]; n[i] = { ...st, checked: !st.checked }; onUpdate({ ...task, subtasks: n }); }}
                style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${st.checked ? "#00C875" : theme.textMuted}`, background: st.checked ? "#00C875" : "transparent", cursor: canEdit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>
                {st.checked && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
              </button>
              <input value={st.title} readOnly={!canEdit} onChange={(e) => { if (!canEdit) return; const n = [...task.subtasks]; n[i] = { ...st, title: e.target.value }; onUpdate({ ...task, subtasks: n }); }}
                style={{ flex: 1, background: "transparent", border: "none", color: theme.text, fontSize: 13, outline: "none", textDecoration: st.checked ? "line-through" : "none", opacity: st.checked ? 0.5 : 1, fontFamily: "'Figtree', sans-serif" }} />
              <StatusBadge value={st.status} compact onChange={(v: string) => { if (!canEdit) return; const n = [...task.subtasks]; n[i] = { ...st, status: v }; onUpdate({ ...task, subtasks: n }); }} theme={theme} disabled={!canEdit} />
              {canEdit && <button onClick={() => onUpdate({ ...task, subtasks: task.subtasks.filter((_: any, j: number) => j !== i) })}
                style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>}
            </div>
          ))}
          {canEdit && (
            <button onClick={() => onUpdate({ ...task, subtasks: [...(task.subtasks || []), { id: genId(), title: "Nova subtarefa", status: "todo", checked: false }] })}
              style={{ marginTop: 6, background: theme.badgeBg("#7B61FF"), border: "1px dashed " + theme.badgeBorder("#7B61FF"), borderRadius: 8, color: "#7B61FF", padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, width: "100%" }}>
              + Adicionar subtarefa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ——— Task Row ———
function TaskRow({ task, projects, users, onUpdate, onOpen, isSubtask, theme, canEdit, isExpanded, onToggleExpand }: any) {
  const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";
  const stDone = (task.subtasks || []).filter((s: Subtask) => s.checked).length;
  const stTotal = (task.subtasks || []).length;
  const assignee = users?.find((u: User) => u.id === task.assignedTo);

  return (
    <div onClick={() => onOpen(task)} className="task-row"
      style={{
        display: "grid",
        gridTemplateColumns: isSubtask ? GRID_COLUMNS_SUBTASK : GRID_COLUMNS,
        alignItems: "center", padding: isSubtask ? "6px 12px 6px 40px" : "10px 12px", gap: 8,
        borderBottom: `1px solid ${theme.border}`, cursor: "pointer", fontSize: 14,
        background: isSubtask ? theme.surfaceHover : "transparent", transition: "background 0.15s"
      }}>
      <button onClick={(e) => { e.stopPropagation(); if (canEdit) onUpdate({ ...task, checked: !task.checked }); }}
        style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${task.checked ? "#00C875" : theme.inputBorder}`, background: task.checked ? "#00C875" : "transparent", cursor: canEdit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
        {task.checked && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {!isSubtask && stTotal > 0 && (
          <button onClick={(e) => { e.stopPropagation(); onToggleExpand?.(task.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: theme.textSecondary, fontSize: 10, padding: "2px 4px", borderRadius: 4, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}>
            ▶
          </button>
        )}
        <span style={{ color: task.checked ? theme.textMuted : theme.text, fontWeight: 500, textDecoration: task.checked ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isSubtask && <span style={{ color: theme.textMuted, marginRight: 6 }}>↳</span>}
          {task.title}
        </span>
        {stTotal > 0 && !isSubtask && <span style={{ fontSize: 11, color: theme.textSecondary, background: theme.inputBg, padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0 }}>{stDone}/{stTotal}</span>}
        {task.link && <a href={task.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#579BFC", fontSize: 12, flexShrink: 0 }}>🔗</a>}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <StatusBadge value={task.status} onChange={(v: string) => onUpdate({ ...task, status: v })} compact={isSubtask} theme={theme} disabled={!canEdit} />
      </div>

      {!isSubtask && (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown options={projects.map((p: Project) => ({ value: p.id, label: p.name, ...p }))} value={task.projectId} onChange={(v: string) => onUpdate({ ...task, projectId: v })} theme={theme} disabled={!canEdit}
            renderOption={(o: any) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: o.color || theme.textSecondary }}>{o.icon} {o.label || o.name}</span>} />
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <input type="date" value={task.deadline || ""} readOnly={!canEdit} onChange={(e) => canEdit && onUpdate({ ...task, deadline: e.target.value })}
          style={{ background: "transparent", border: "none", color: overdue ? "#E2445C" : theme.textSecondary, fontSize: 13, outline: "none", width: "100%", colorScheme: theme.scheme, cursor: canEdit ? "pointer" : "default", fontFamily: "'Figtree', sans-serif" }} />
      </div>

      {!isSubtask && (
        <div onClick={(e) => e.stopPropagation()}>
          <PriorityBadge value={task.priority} onChange={(v: string) => onUpdate({ ...task, priority: v })} theme={theme} disabled={!canEdit} />
        </div>
      )}

      {!isSubtask && (
        <div style={{ textAlign: "center" }} title={assignee?.name || ""}>
          <span style={{ fontSize: 16 }}>{assignee?.avatar || "—"}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button onClick={(e) => { e.stopPropagation(); onOpen(task); }}
          style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }}>❯</button>
      </div>
    </div>
  );
}

// ——— Group Header ———
function GroupHeader({ group, collapsed, onToggle, taskCount, theme }: { group: Group; collapsed: boolean; onToggle: () => void; taskCount: number; theme: Theme }) {
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      borderLeft: `4px solid ${group.color}`, background: theme.surfaceHover,
      cursor: "pointer", userSelect: "none", borderBottom: `1px solid ${theme.border}`
    }}>
      <span style={{ fontSize: 10, color: group.color, transition: "transform 0.2s", transform: collapsed ? "rotate(0deg)" : "rotate(90deg)", fontWeight: 700 }}>▶</span>
      <span style={{ fontSize: 16 }}>{group.icon}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: group.color }}>{group.name}</span>
      <span style={{ fontSize: 12, color: theme.textMuted, background: theme.inputBg, padding: "2px 8px", borderRadius: 10 }}>{taskCount}</span>
    </div>
  );
}

// ——— Inline Add Row ———
function InlineAddRow({ groupProjectId, theme, onAdd }: { groupProjectId: string; theme: Theme; onAdd: (title: string, projectId: string) => void }) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active && inputRef.current) inputRef.current.focus();
  }, [active]);

  const submit = () => {
    if (value.trim()) {
      onAdd(value.trim(), groupProjectId);
      setValue("");
      setActive(false);
    }
  };

  if (!active) {
    return (
      <div onClick={() => setActive(true)} style={{
        display: "grid", gridTemplateColumns: GRID_COLUMNS, padding: "8px 12px", gap: 8,
        cursor: "pointer", borderBottom: `1px solid ${theme.border}`, opacity: 0.5,
        transition: "opacity 0.15s", fontSize: 14, color: theme.textMuted
      }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}>
        <div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>+</span> Adicionar tarefa
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: GRID_COLUMNS, padding: "8px 12px", gap: 8,
      borderBottom: `1px solid ${theme.border}`, background: theme.surfaceHover
    }}>
      <div></div>
      <div>
        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setValue(""); setActive(false); } }}
          onBlur={() => { if (!value.trim()) setActive(false); }}
          placeholder="Nome da tarefa..."
          style={{
            width: "100%", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
            borderRadius: 6, padding: "6px 10px", color: theme.text, fontSize: 13,
            outline: "none", fontFamily: "'Figtree', sans-serif"
          }} />
      </div>
    </div>
  );
}

// ——— Main App ———
export default function TaskManager() {
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("taskhub-theme") || "dark";
    }
    return "dark";
  });
  const theme = themes[mode];

  useEffect(() => {
    localStorage.setItem("taskhub-theme", mode);
  }, [mode]);

  const [useApi, setUseApi] = useState(false);
  useEffect(() => {
    fetch("/api/health").then(r => r.ok ? setUseApi(true) : setUseApi(false)).catch(() => setUseApi(false));
  }, []);

  const [users, setUsers] = useState(DEMO_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [activeProject, setActiveProject] = useState("all");
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdmin, setShowAdmin] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const isAdmin = currentUser?.role === "admin";
  const isEditor = currentUser?.role === "editor";
  const canEdit = isAdmin || isEditor;

  const visibleProjects = projects.filter((p) => {
    if (isAdmin) return true;
    return p.ownerId === currentUser?.id || (p.sharedWith || []).includes(currentUser?.id || "");
  });

  const filteredTasks = tasks.filter((t) => {
    const proj = projects.find((p) => p.id === t.projectId);
    if (!proj) return false;
    if (!isAdmin && proj.ownerId !== currentUser?.id && !(proj.sharedWith || []).includes(currentUser?.id || "")) return false;
    if (activeProject !== "all" && t.projectId !== activeProject) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const groups: Group[] = useMemo(() => {
    if (activeProject !== "all") {
      const proj = projects.find((p) => p.id === activeProject);
      if (!proj) return [];
      return [{ id: proj.id, name: proj.name, color: proj.color, icon: proj.icon, tasks: filteredTasks }];
    }
    const groupMap = new Map<string, Group>();
    filteredTasks.forEach((t) => {
      const proj = projects.find((p) => p.id === t.projectId);
      if (!proj) return;
      if (!groupMap.has(proj.id)) {
        groupMap.set(proj.id, { id: proj.id, name: proj.name, color: proj.color, icon: proj.icon, tasks: [] });
      }
      groupMap.get(proj.id)!.tasks.push(t);
    });
    return Array.from(groupMap.values());
  }, [filteredTasks, activeProject, projects]);

  const toggleExpandTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const toggleCollapseGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    if (!useApi) return;
    try {
      const [u, p, t] = await Promise.all([api.getUsers(), api.getProjects(), api.getTasks()]);
      setUsers(u.map((x: any) => ({ ...x, passwordHash: "" })));
      setProjects(p.map((x: any) => ({ ...x, ownerId: x.owner_id || x.ownerId, sharedWith: x.sharedWith || [] })));
      setTasks(t);
    } catch { /* fallback to local */ }
  }, [useApi]);

  // Auto-login from saved token
  useEffect(() => {
    if (!useApi || currentUser) return;
    if (api.hasToken()) {
      api.me().then((u: any) => { setCurrentUser(u); }).catch(() => api.logout());
    }
  }, [useApi, currentUser]);

  useEffect(() => { if (useApi && currentUser) loadData(); }, [useApi, currentUser, loadData]);

  const updateTask = async (updated: Task) => {
    if (!canEdit) return;
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (detailTask && detailTask.id === updated.id) setDetailTask(updated);
    if (useApi) {
      try { await api.updateTask(updated.id, { title: updated.title, description: updated.description, status: updated.status, priority: updated.priority, deadline: updated.deadline, projectId: updated.projectId, assignedTo: updated.assignedTo, link: updated.link, checked: updated.checked, checklist: updated.checklist, subtasks: updated.subtasks }); } catch {}
    }
  };

  const addTask = async () => {
    if (!canEdit || !currentUser) return;
    const projectId = activeProject === "all" ? visibleProjects[0]?.id || "" : activeProject;
    if (useApi) {
      try { const nt = await api.createTask({ title: "Nova tarefa", status: "todo", priority: "medium", projectId, assignedTo: currentUser.id }); setTasks((prev) => [nt, ...prev]); setDetailTask(nt); return; } catch {}
    }
    const nt: Task = { id: genId(), title: "Nova tarefa", status: "todo", priority: "medium", deadline: "", projectId, link: "", checked: false, description: "", checklist: [], subtasks: [], assignedTo: currentUser.id, createdBy: currentUser.id };
    setTasks((prev) => [nt, ...prev]);
    setDetailTask(nt);
  };

  const addTaskInline = async (title: string, projectId: string) => {
    if (!canEdit || !currentUser) return;
    if (useApi) {
      try { const nt = await api.createTask({ title, status: "todo", priority: "medium", projectId, assignedTo: currentUser.id }); setTasks((prev) => [...prev, nt]); return; } catch {}
    }
    const nt: Task = { id: genId(), title, status: "todo", priority: "medium", deadline: "", projectId, link: "", checked: false, description: "", checklist: [], subtasks: [], assignedTo: currentUser.id, createdBy: currentUser.id };
    setTasks((prev) => [...prev, nt]);
  };

  const addProject = () => {
    if (!newProjectName.trim() || !isAdmin || !currentUser) return;
    const colors = ["#7B61FF", "#00C875", "#FF6B6B", "#FDAB3D", "#579BFC", "#FF78CB", "#9B59B6", "#1ABC9C"];
    const icons = ["📌", "⚡", "💡", "🎯", "🔥", "🌟", "🚀", "🌐"];
    setProjects((prev) => [...prev, {
      id: "proj-" + genId(), name: newProjectName.trim(),
      color: colors[Math.floor(Math.random() * colors.length)],
      icon: icons[Math.floor(Math.random() * icons.length)],
      ownerId: currentUser.id, sharedWith: []
    }]);
    setNewProjectName(""); setShowNewProject(false);
  };

  const counts: Record<string, number> = { all: filteredTasks.length };
  visibleProjects.forEach((p) => { counts[p.id] = tasks.filter((t) => t.projectId === p.id).length; });
  const activeProj = projects.find((p) => p.id === activeProject);

  const handleLogin = async (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    if (useApi) { api.logout(); setUsers(DEMO_USERS); setProjects(INITIAL_PROJECTS); setTasks(INITIAL_TASKS); }
  };

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} theme={theme} onToggleTheme={() => setMode(mode === "dark" ? "light" : "dark")} useApi={useApi} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Figtree', sans-serif", background: theme.bg, color: theme.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300..900&family=Poppins:wght@600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.scrollThumb}; border-radius: 10px; }
        .task-row:hover { background: ${theme.surfaceHover} !important; }
        .sidebar-item { transition: all 0.15s; border: none; cursor: pointer; width: 100%; text-align: left; font-family: 'Figtree', sans-serif; }
        .sidebar-item:hover { background: ${theme.surfaceHover} !important; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes shakeX { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        input::placeholder, textarea::placeholder { color: ${theme.textMuted}; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 260, background: theme.sidebar, borderRight: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 20px 20px", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #7B61FF, #579BFC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff" }}>✦</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5, fontFamily: "'Poppins', sans-serif" }}>Task Hub</div>
                <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 500 }}>Gestor de Tarefas</div>
              </div>
            </div>
            <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.inputBg, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text }}>
              {mode === "dark" ? "☀️" : "🌙"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: theme.inputBg }}>
            <span style={{ fontSize: 20 }}>{currentUser.avatar}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.name}</div>
              <div style={{ fontSize: 11, color: ROLES[currentUser.role].color, fontWeight: 600 }}>{ROLES[currentUser.role].icon} {ROLES[currentUser.role].label}</div>
            </div>
            <button onClick={handleLogout} title="Sair"
              style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14 }}>🚪</button>
          </div>
        </div>

        <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", padding: "0 8px", marginBottom: 8 }}>Projetos</div>

          <button className="sidebar-item" onClick={() => setActiveProject("all")}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: 500, background: activeProject === "all" ? theme.badgeBg("#7B61FF") : "transparent", color: activeProject === "all" ? "#7B61FF" : theme.textSecondary }}>
            <span style={{ fontSize: 16 }}>📊</span><span style={{ flex: 1 }}>Todos</span>
            <span style={{ fontSize: 12, color: theme.textMuted, background: theme.inputBg, padding: "2px 8px", borderRadius: 10 }}>{counts.all}</span>
          </button>

          {visibleProjects.map((proj) => (
            <button key={proj.id} className="sidebar-item" onClick={() => setActiveProject(proj.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: 500, background: activeProject === proj.id ? theme.badgeBg(proj.color) : "transparent", color: activeProject === proj.id ? proj.color : theme.textSecondary }}>
              <span style={{ fontSize: 16 }}>{proj.icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
              <span style={{ fontSize: 12, color: theme.textMuted, background: theme.inputBg, padding: "2px 8px", borderRadius: 10 }}>{counts[proj.id] || 0}</span>
            </button>
          ))}

          {isAdmin && (
            showNewProject ? (
              <div style={{ display: "flex", gap: 4, marginTop: 8, padding: "0 4px" }}>
                <input autoFocus value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProject()} placeholder="Nome do projeto"
                  style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "6px 10px", color: theme.text, fontSize: 12, outline: "none", fontFamily: "'Figtree', sans-serif" }} />
                <button onClick={addProject} style={{ background: "#7B61FF", border: "none", color: "#fff", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                <button onClick={() => setShowNewProject(false)} style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowNewProject(true)} className="sidebar-item"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, marginTop: 6, fontSize: 12, color: theme.textMuted, background: "transparent" }}>
                <span style={{ fontSize: 14 }}>+</span> Novo projeto
              </button>
            )
          )}
        </div>

        <div style={{ padding: "12px 12px", borderTop: `1px solid ${theme.border}` }}>
          {isAdmin && (
            <button onClick={() => setShowAdmin(true)} className="sidebar-item"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#E2445C", background: "transparent" }}>
              ⚙️ Painel Admin
            </button>
          )}
          <div style={{ padding: "8px 12px", marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: theme.textMuted }}>
              <span>Total: <b style={{ color: theme.text }}>{filteredTasks.length}</b></span>
              <span style={{ color: "#00C875" }}>✓ {tasks.filter((t) => t.status === "done").length}</span>
              <span style={{ color: "#E2445C" }}>⚠ {tasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
              {activeProj ? `${activeProj.icon} ${activeProj.name}` : "📊 Todas as Tarefas"}
            </h1>
            <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{filteredTasks.length} tarefa{filteredTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, fontSize: 14 }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefas..."
              style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px 8px 34px", color: theme.text, fontSize: 14, outline: "none", width: 200, fontFamily: "'Figtree', sans-serif" }} />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px", color: theme.text, fontSize: 14, outline: "none", cursor: "pointer", colorScheme: theme.scheme, fontFamily: "'Figtree', sans-serif" }}>
            <option value="all">Todos Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {canEdit && (
            <button onClick={addTask}
              style={{ background: "linear-gradient(135deg, #7B61FF, #579BFC)", border: "none", color: "#fff", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 16px rgba(123,97,255,0.3)" }}>
              <span style={{ fontSize: 16 }}>+</span> Nova Tarefa
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredTasks.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Nenhuma tarefa encontrada</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{canEdit ? "Clique em \"+ Nova Tarefa\" para começar" : "Peça ao admin para compartilhar projetos com você"}</div>
            </div>
          )}
          {groups.map((group) => (
            <div key={group.id}>
              <GroupHeader group={group} collapsed={collapsedGroups.has(group.id)} onToggle={() => toggleCollapseGroup(group.id)} taskCount={group.tasks.length} theme={theme} />
              {!collapsedGroups.has(group.id) && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, padding: "10px 12px", gap: 8, borderBottom: `1px solid ${theme.borderStrong}`, fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1.2, background: theme.surfaceHover, borderLeft: `4px solid ${group.color}` }}>
                    <div></div><div>Tarefa</div><div>Status</div><div>Projeto</div><div>Prazo</div><div>Prioridade</div><div style={{ textAlign: "center" }}>🤵</div><div></div>
                  </div>
                  {group.tasks.map((task) => (
                    <div key={task.id} style={{ borderLeft: `4px solid ${group.color}` }}>
                      <TaskRow task={task} projects={visibleProjects} users={users} onUpdate={updateTask} onOpen={setDetailTask} theme={theme} canEdit={canEdit} isExpanded={expandedTasks.has(task.id)} onToggleExpand={toggleExpandTask} />
                      {expandedTasks.has(task.id) && (task.subtasks || []).map((st) => (
                        <TaskRow key={st.id} task={st} projects={visibleProjects} users={users} isSubtask canEdit={canEdit}
                          onUpdate={(updated: any) => { const n = task.subtasks.map((s) => (s.id === updated.id ? updated : s)); updateTask({ ...task, subtasks: n }); }}
                          onOpen={() => setDetailTask(task)} theme={theme} />
                      ))}
                    </div>
                  ))}
                  {canEdit && <div style={{ borderLeft: `4px solid ${group.color}` }}><InlineAddRow groupProjectId={group.id} theme={theme} onAdd={addTaskInline} /></div>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {detailTask && (
        <TaskDetail task={detailTask} projects={visibleProjects} users={users}
          onUpdate={(u: Task) => { updateTask(u); setDetailTask(u); }}
          onClose={() => setDetailTask(null)} theme={theme} canEdit={canEdit} />
      )}

      {showAdmin && isAdmin && (
        <AdminPanel users={users} projects={projects} tasks={tasks}
          onUpdateUsers={setUsers} onUpdateProjects={setProjects}
          onClose={() => setShowAdmin(false)} theme={theme} currentUser={currentUser} />
      )}
    </div>
  );
}
