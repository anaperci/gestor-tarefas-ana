"use client";

import { useState, useEffect, useRef, createContext, useContext, CSSProperties, ReactNode } from "react";

// ——— Auth Context ———
const AuthContext = createContext<any>(null);

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

const DEMO_USERS: User[] = [
  { id: "user-1", username: "ana", name: "Ana (Admin)", passwordHash: hashPassword("admin123"), role: "admin", avatar: "\ud83d\udc51" },
  { id: "user-2", username: "maria", name: "Maria Silva", passwordHash: hashPassword("maria123"), role: "editor", avatar: "\ud83c\udfa8" },
  { id: "user-3", username: "joao", name: "Jo\u00e3o Santos", passwordHash: hashPassword("joao123"), role: "viewer", avatar: "\ud83d\udc41\ufe0f" },
];

const ROLES: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  admin: { label: "Admin", color: "#E2445C", icon: "\ud83d\udc51", desc: "Acesso total. Cria usu\u00e1rios, projetos, gerencia tudo." },
  editor: { label: "Editor", color: "#FDAB3D", icon: "\u270f\ufe0f", desc: "Cria e edita tarefas nos projetos compartilhados." },
  viewer: { label: "Visualizador", color: "#579BFC", icon: "\ud83d\udc41\ufe0f", desc: "Apenas visualiza tarefas e projetos compartilhados." },
};

const INITIAL_PROJECTS: Project[] = [
  { id: "proj-1", name: "PERCI", color: "#7B61FF", icon: "\ud83d\ude80", ownerId: "user-1", sharedWith: ["user-2", "user-3"] },
  { id: "proj-2", name: "NexIA Lab", color: "#00C875", icon: "\ud83e\udd16", ownerId: "user-1", sharedWith: ["user-2"] },
  { id: "proj-3", name: "Imers\u00e3o 10K", color: "#FF6B6B", icon: "\ud83d\udd25", ownerId: "user-1", sharedWith: [] },
];

const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog", color: "#A0A0A0" },
  { value: "todo", label: "A Fazer", color: "#579BFC" },
  { value: "doing", label: "Em Progresso", color: "#FDAB3D" },
  { value: "review", label: "Revis\u00e3o", color: "#E2445C" },
  { value: "done", label: "Conclu\u00eddo", color: "#00C875" },
];

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Cr\u00edtica", bg: "#E2445C" },
  { value: "high", label: "Alta", bg: "#FDAB3D" },
  { value: "medium", label: "M\u00e9dia", bg: "#579BFC" },
  { value: "low", label: "Baixa", bg: "#A0A0A0" },
];

const genId = () => Math.random().toString(36).slice(2, 10);

const INITIAL_TASKS: Task[] = [
  {
    id: genId(), title: "Gravar v\u00eddeo de vendas Imers\u00e3o 10K", status: "doing", priority: "critical",
    deadline: "2026-02-15", projectId: "proj-3", link: "", checked: false,
    description: "Gravar o v\u00eddeo principal de vendas para a p\u00e1gina da Imers\u00e3o 10K com IA.",
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
    description: "", assignedTo: "user-2", createdBy: "user-1", checklist: [], subtasks: [],
  },
  {
    id: genId(), title: "Criar prompt de copywriting avan\u00e7ado", status: "backlog", priority: "medium",
    deadline: "2026-02-28", projectId: "proj-1", link: "", checked: false,
    description: "", assignedTo: "user-2", createdBy: "user-1", checklist: [], subtasks: [],
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
    bg: "#F5F6FA", sidebar: "#FFFFFF", surface: "#FFFFFF", surfaceHover: "rgba(0,0,0,0.02)",
    border: "rgba(0,0,0,0.06)", borderStrong: "rgba(0,0,0,0.09)",
    text: "#1A1D2E", textSecondary: "#5A6178", textMuted: "#9CA3B8",
    inputBg: "rgba(0,0,0,0.03)", inputBorder: "rgba(0,0,0,0.1)",
    dropdownBg: "#FFFFFF", dropdownHover: "rgba(0,0,0,0.04)",
    badgeBg: (c: string) => c + "15", badgeBorder: (c: string) => c + "30",
    scrollThumb: "rgba(0,0,0,0.12)", overlay: "rgba(0,0,0,0.25)", scheme: "light",
    loginBg: "linear-gradient(135deg, #F5F6FA 0%, #E8EAF0 50%, #F0F1F5 100%)",
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
                fontFamily: "'DM Sans', sans-serif"
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
          padding: compact ? "3px 10px" : "4px 14px", fontSize: compact ? 11 : 12,
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
          padding: "4px 14px", fontSize: 12, fontWeight: 600,
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
          }}>{item.done && <span style={{ color: "#fff", fontSize: 11 }}>\u2713</span>}</button>
          <span style={{ flex: 1, fontSize: 13, color: item.done ? theme.textMuted : theme.text, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
          {!disabled && <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14, padding: "0 4px", opacity: 0.6 }}>\u00d7</button>}
        </div>
      ))}
      {!disabled && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Adicionar item..."
            style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "6px 10px", color: theme.text, fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
          <button onClick={add} style={{ background: "#7B61FF", border: "none", borderRadius: 6, color: "#fff", padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>+</button>
        </div>
      )}
    </div>
  );
}

// ——— Login Screen ———
function LoginScreen({ users, onLogin, theme, onToggleTheme }: any) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleLogin = () => {
    const user = users.find((u: User) => u.username === username.toLowerCase().trim());
    if (!user) { triggerError("Usu\u00e1rio n\u00e3o encontrado"); return; }
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
      background: theme.loginBg, fontFamily: "'DM Sans', sans-serif", padding: 20,
      position: "relative"
    }}>
      <button onClick={onToggleTheme} style={{
        position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: 12,
        border: `1px solid ${theme.border}`, background: theme.inputBg, cursor: "pointer",
        fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text
      }}>
        {theme.scheme === "dark" ? "\u2600\ufe0f" : "\ud83c\udf19"}
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
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
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
          }}>\u2726</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: -0.5, margin: 0 }}>Task Hub</h1>
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>Fa\u00e7a login para continuar</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.3 }}>Usu\u00e1rio</label>
          <input
            value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="seu.usuario"
            autoFocus
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              background: theme.inputBg, border: `1.5px solid ${error ? "#E2445C" : theme.inputBorder}`,
              color: theme.text, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
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
            placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              background: theme.inputBg, border: `1.5px solid ${error ? "#E2445C" : theme.inputBorder}`,
              color: theme.text, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif",
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
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Credenciais de teste</div>
          {[
            { u: "ana", p: "admin123", r: "Admin \ud83d\udc51" },
            { u: "maria", p: "maria123", r: "Editor \u270f\ufe0f" },
            { u: "joao", p: "joao123", r: "Viewer \ud83d\udc41\ufe0f" },
          ].map((c) => (
            <button key={c.u} onClick={() => { setUsername(c.u); setPassword(c.p); setError(""); }}
              style={{
                display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 8px",
                background: "transparent", border: "none", color: theme.textSecondary,
                fontSize: 12, cursor: "pointer", borderRadius: 6, fontFamily: "'DM Sans', sans-serif"
              }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.background = theme.dropdownHover}
              onMouseLeave={(e) => (e.target as HTMLElement).style.background = "transparent"}>
              <span><b style={{ color: theme.text }}>{c.u}</b> / {c.p}</span>
              <span>{c.r}</span>
            </button>
          ))}
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
    const avatars: Record<string, string> = { admin: "\ud83d\udc51", editor: "\u270f\ufe0f", viewer: "\ud83d\udc41\ufe0f" };
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
    if (!window.confirm("Deletar este usu\u00e1rio?")) return;
    onUpdateUsers(users.filter((u: User) => u.id !== userId));
  };

  const changeRole = (userId: string, newRole: string) => {
    const avatars: Record<string, string> = { admin: "\ud83d\udc51", editor: "\u270f\ufe0f", viewer: "\ud83d\udc41\ufe0f" };
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
    padding: "8px 12px", color: theme.text, fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif"
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
            <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text, margin: 0, letterSpacing: -0.3 }}>\u2699\ufe0f Painel Admin</h2>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Gerenciar usu\u00e1rios e permiss\u00f5es</p>
          </div>
          <button onClick={onClose} style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>\u2715</button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: `1px solid ${theme.border}` }}>
          {[{ key: "users", label: "\ud83d\udc65 Usu\u00e1rios" }, { key: "permissions", label: "\ud83d\udd10 Permiss\u00f5es" }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 20px", border: "none", borderBottom: tab === t.key ? "2px solid #7B61FF" : "2px solid transparent",
              background: "transparent", color: tab === t.key ? "#7B61FF" : theme.textSecondary,
              fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s", marginBottom: -1
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ padding: "20px 28px 28px", overflowY: "auto", flex: 1 }}>
          {tab === "users" && (
            <>
              <div style={{ padding: 16, borderRadius: 12, background: theme.inputBg, border: `1px solid ${theme.border}`, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 12 }}>Criar novo usu\u00e1rio</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
                  <div>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>Usu\u00e1rio</div>
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
                Marque os usu\u00e1rios que ter\u00e3o acesso a cada projeto. Admins sempre t\u00eam acesso total.
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
                            cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                            transition: "all 0.15s"
                          }}>
                          <span style={{ fontSize: 14 }}>{isShared ? "\u2713" : "+"}</span>
                          {user.avatar} {user.name}
                          <span style={{ fontSize: 10, opacity: 0.7 }}>({ROLES[user.role].label})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: theme.inputBg, border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, marginBottom: 10 }}>Legenda de Permiss\u00f5es</div>
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
          {user.name} {isMe && <span style={{ fontSize: 10, color: "#7B61FF" }}>(voc\u00ea)</span>}
        </div>
        <div style={{ fontSize: 12, color: theme.textMuted }}>@{user.username}</div>
      </div>

      <select value={user.role} onChange={(e) => onChangeRole(e.target.value)} disabled={isMe}
        style={{
          background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
          padding: "5px 8px", color: role.color, fontSize: 12, fontWeight: 600, outline: "none",
          cursor: isMe ? "default" : "pointer", colorScheme: theme.scheme, fontFamily: "'DM Sans', sans-serif"
        }}>
        {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
      </select>

      {showReset ? (
        <div style={{ display: "flex", gap: 4 }}>
          <input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Nova senha"
            style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "5px 8px", color: theme.text, fontSize: 12, outline: "none", width: 120, fontFamily: "'DM Sans', sans-serif" }} />
          <button onClick={() => { if (newPwd.trim()) { onResetPassword(newPwd); setShowReset(false); setNewPwd(""); } }}
            style={{ background: "#00C875", border: "none", color: "#fff", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>\u2713</button>
          <button onClick={() => setShowReset(false)}
            style={{ background: theme.inputBg, border: "none", color: theme.textMuted, borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 11 }}>\u2715</button>
        </div>
      ) : (
        <button onClick={() => setShowReset(true)}
          style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "5px 12px", color: theme.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
          \ud83d\udd11 Reset
        </button>
      )}

      {!isMe && (
        <button onClick={onDelete}
          style={{ background: "rgba(226,68,92,0.1)", border: "1px solid rgba(226,68,92,0.2)", borderRadius: 8, padding: "5px 10px", color: "#E2445C", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
          \ud83d\uddd1\ufe0f
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
              style={{ display: "block", width: "100%", background: "transparent", border: "none", color: theme.text, fontSize: 22, fontWeight: 700, outline: "none", fontFamily: "'DM Sans', sans-serif", padding: 0, marginTop: 6, cursor: canEdit ? "text" : "default" }} />
          </div>
          <button onClick={onClose} style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>\u2715</button>
        </div>

        {!canEdit && (
          <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(87,155,252,0.1)", border: "1px solid rgba(87,155,252,0.2)", color: "#579BFC", fontSize: 12, fontWeight: 500, marginBottom: 20 }}>
            \ud83d\udc41\ufe0f Modo visualiza\u00e7\u00e3o \u2014 voc\u00ea n\u00e3o tem permiss\u00e3o para editar
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
              style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "5px 10px", color: theme.text, fontSize: 13, outline: "none", colorScheme: theme.scheme, fontFamily: "'DM Sans', sans-serif" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Respons\u00e1vel</div>
            {canEdit ? (
              <Dropdown
                options={users.map((u: User) => ({ value: u.id, label: u.name, ...u }))}
                value={task.assignedTo || ""} onChange={(v: string) => onUpdate({ ...task, assignedTo: v })} theme={theme}
                renderOption={(o: any) => <span style={{ fontSize: 12, color: theme.text }}>{o.avatar} {o.label || o.name}</span>}
              />
            ) : (
              <span style={{ fontSize: 12, color: theme.text }}>
                {(() => { const u = users.find((u: User) => u.id === task.assignedTo); return u ? `${u.avatar} ${u.name}` : "\u2014"; })()}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Link</div>
          {canEdit ? (
            <input value={task.link || ""} onChange={(e) => onUpdate({ ...task, link: e.target.value })} placeholder="https://..."
              style={{ width: "100%", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "8px 12px", color: "#579BFC", fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
          ) : task.link ? (
            <a href={task.link} target="_blank" rel="noopener noreferrer" style={{ color: "#579BFC", fontSize: 13 }}>{task.link}</a>
          ) : <span style={{ color: theme.textMuted, fontSize: 13 }}>\u2014</span>}
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 600, marginBottom: 8 }}>Descri\u00e7\u00e3o</div>
          <textarea value={task.description || ""} readOnly={!canEdit} onChange={(e) => canEdit && onUpdate({ ...task, description: e.target.value })}
            placeholder={canEdit ? "Adicione uma descri\u00e7\u00e3o detalhada..." : "Sem descri\u00e7\u00e3o"}
            rows={4}
            style={{ width: "100%", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "12px 14px", color: theme.text, fontSize: 14, outline: "none", resize: canEdit ? "vertical" : "none", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }} />
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
                {st.checked && <span style={{ color: "#fff", fontSize: 10 }}>\u2713</span>}
              </button>
              <input value={st.title} readOnly={!canEdit} onChange={(e) => { if (!canEdit) return; const n = [...task.subtasks]; n[i] = { ...st, title: e.target.value }; onUpdate({ ...task, subtasks: n }); }}
                style={{ flex: 1, background: "transparent", border: "none", color: theme.text, fontSize: 13, outline: "none", textDecoration: st.checked ? "line-through" : "none", opacity: st.checked ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif" }} />
              <StatusBadge value={st.status} compact onChange={(v: string) => { if (!canEdit) return; const n = [...task.subtasks]; n[i] = { ...st, status: v }; onUpdate({ ...task, subtasks: n }); }} theme={theme} disabled={!canEdit} />
              {canEdit && <button onClick={() => onUpdate({ ...task, subtasks: task.subtasks.filter((_: any, j: number) => j !== i) })}
                style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14, padding: "0 4px" }}>\u00d7</button>}
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
function TaskRow({ task, projects, users, onUpdate, onOpen, isSubtask, theme, canEdit }: any) {
  const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";
  const stDone = (task.subtasks || []).filter((s: Subtask) => s.checked).length;
  const stTotal = (task.subtasks || []).length;
  const assignee = users?.find((u: User) => u.id === task.assignedTo);

  return (
    <div onClick={() => onOpen(task)} className="task-row"
      style={{
        display: "grid",
        gridTemplateColumns: isSubtask ? "36px 1fr 130px 110px 60px" : "36px 1fr 130px 130px 110px 100px 60px 60px",
        alignItems: "center", padding: isSubtask ? "6px 12px 6px 40px" : "10px 12px", gap: 8,
        borderBottom: `1px solid ${theme.border}`, cursor: "pointer", fontSize: 13,
        background: isSubtask ? theme.surfaceHover : "transparent", transition: "background 0.15s"
      }}>
      <button onClick={(e) => { e.stopPropagation(); if (canEdit) onUpdate({ ...task, checked: !task.checked }); }}
        style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${task.checked ? "#00C875" : theme.inputBorder}`, background: task.checked ? "#00C875" : "transparent", cursor: canEdit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
        {task.checked && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>\u2713</span>}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ color: task.checked ? theme.textMuted : theme.text, fontWeight: 500, textDecoration: task.checked ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isSubtask && <span style={{ color: theme.textMuted, marginRight: 6 }}>\u21b3</span>}
          {task.title}
        </span>
        {stTotal > 0 && !isSubtask && <span style={{ fontSize: 10, color: theme.textSecondary, background: theme.inputBg, padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0 }}>{stDone}/{stTotal}</span>}
        {task.link && <a href={task.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#579BFC", fontSize: 12, flexShrink: 0 }}>\ud83d\udd17</a>}
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <StatusBadge value={task.status} onChange={(v: string) => onUpdate({ ...task, status: v })} compact={isSubtask} theme={theme} disabled={!canEdit} />
      </div>

      {!isSubtask && (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown options={projects.map((p: Project) => ({ value: p.id, label: p.name, ...p }))} value={task.projectId} onChange={(v: string) => onUpdate({ ...task, projectId: v })} theme={theme} disabled={!canEdit}
            renderOption={(o: any) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: o.color || theme.textSecondary }}>{o.icon} {o.label || o.name}</span>} />
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <input type="date" value={task.deadline || ""} readOnly={!canEdit} onChange={(e) => canEdit && onUpdate({ ...task, deadline: e.target.value })}
          style={{ background: "transparent", border: "none", color: overdue ? "#E2445C" : theme.textSecondary, fontSize: 12, outline: "none", width: "100%", colorScheme: theme.scheme, cursor: canEdit ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif" }} />
      </div>

      {!isSubtask && (
        <div onClick={(e) => e.stopPropagation()}>
          <PriorityBadge value={task.priority} onChange={(v: string) => onUpdate({ ...task, priority: v })} theme={theme} disabled={!canEdit} />
        </div>
      )}

      {!isSubtask && (
        <div style={{ textAlign: "center" }} title={assignee?.name || ""}>
          <span style={{ fontSize: 16 }}>{assignee?.avatar || "\u2014"}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button onClick={(e) => { e.stopPropagation(); onOpen(task); }}
          style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }}>\u276f</button>
      </div>
    </div>
  );
}

// ——— Main App ———
export default function TaskManager() {
  const [mode, setMode] = useState("dark");
  const theme = themes[mode];
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

  const updateTask = (updated: Task) => {
    if (!canEdit) return;
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (detailTask && detailTask.id === updated.id) setDetailTask(updated);
  };

  const addTask = () => {
    if (!canEdit || !currentUser) return;
    const nt: Task = {
      id: genId(), title: "Nova tarefa", status: "todo", priority: "medium", deadline: "",
      projectId: activeProject === "all" ? visibleProjects[0]?.id || "" : activeProject,
      link: "", checked: false, description: "", checklist: [], subtasks: [],
      assignedTo: currentUser.id, createdBy: currentUser.id
    };
    setTasks((prev) => [nt, ...prev]);
    setDetailTask(nt);
  };

  const addProject = () => {
    if (!newProjectName.trim() || !isAdmin || !currentUser) return;
    const colors = ["#7B61FF", "#00C875", "#FF6B6B", "#FDAB3D", "#579BFC", "#FF78CB", "#9B59B6", "#1ABC9C"];
    const icons = ["\ud83d\udccc", "\u26a1", "\ud83d\udca1", "\ud83c\udfaf", "\ud83d\udd25", "\ud83c\udf1f", "\ud83d\ude80", "\ud83c\udf10"];
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

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={setCurrentUser} theme={theme} onToggleTheme={() => setMode(mode === "dark" ? "light" : "dark")} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans', sans-serif", background: theme.bg, color: theme.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.scrollThumb}; border-radius: 10px; }
        .task-row:hover { background: ${theme.surfaceHover} !important; }
        .sidebar-item { transition: all 0.15s; border: none; cursor: pointer; width: 100%; text-align: left; font-family: 'DM Sans', sans-serif; }
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
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #7B61FF, #579BFC)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff" }}>\u2726</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5 }}>Task Hub</div>
                <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 500 }}>Gestor de Tarefas</div>
              </div>
            </div>
            <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.inputBg, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text }}>
              {mode === "dark" ? "\u2600\ufe0f" : "\ud83c\udf19"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: theme.inputBg }}>
            <span style={{ fontSize: 20 }}>{currentUser.avatar}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.name}</div>
              <div style={{ fontSize: 10, color: ROLES[currentUser.role].color, fontWeight: 600 }}>{ROLES[currentUser.role].icon} {ROLES[currentUser.role].label}</div>
            </div>
            <button onClick={() => setCurrentUser(null)} title="Sair"
              style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14 }}>\ud83d\udeaa</button>
          </div>
        </div>

        <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", padding: "0 8px", marginBottom: 8 }}>Projetos</div>

          <button className="sidebar-item" onClick={() => setActiveProject("all")}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, fontSize: 13, fontWeight: 500, background: activeProject === "all" ? theme.badgeBg("#7B61FF") : "transparent", color: activeProject === "all" ? "#7B61FF" : theme.textSecondary }}>
            <span style={{ fontSize: 16 }}>\ud83d\udcca</span><span style={{ flex: 1 }}>Todos</span>
            <span style={{ fontSize: 11, color: theme.textMuted, background: theme.inputBg, padding: "2px 8px", borderRadius: 10 }}>{counts.all}</span>
          </button>

          {visibleProjects.map((proj) => (
            <button key={proj.id} className="sidebar-item" onClick={() => setActiveProject(proj.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, fontSize: 13, fontWeight: 500, background: activeProject === proj.id ? theme.badgeBg(proj.color) : "transparent", color: activeProject === proj.id ? proj.color : theme.textSecondary }}>
              <span style={{ fontSize: 16 }}>{proj.icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
              <span style={{ fontSize: 11, color: theme.textMuted, background: theme.inputBg, padding: "2px 8px", borderRadius: 10 }}>{counts[proj.id] || 0}</span>
            </button>
          ))}

          {isAdmin && (
            showNewProject ? (
              <div style={{ display: "flex", gap: 4, marginTop: 8, padding: "0 4px" }}>
                <input autoFocus value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProject()} placeholder="Nome do projeto"
                  style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "6px 10px", color: theme.text, fontSize: 12, outline: "none", fontFamily: "'DM Sans', sans-serif" }} />
                <button onClick={addProject} style={{ background: "#7B61FF", border: "none", color: "#fff", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>\u2713</button>
                <button onClick={() => setShowNewProject(false)} style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 12 }}>\u2715</button>
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
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#E2445C", background: "transparent" }}>
              \u2699\ufe0f Painel Admin
            </button>
          )}
          <div style={{ padding: "8px 12px", marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: theme.textMuted }}>
              <span>Total: <b style={{ color: theme.text }}>{filteredTasks.length}</b></span>
              <span style={{ color: "#00C875" }}>\u2713 {tasks.filter((t) => t.status === "done").length}</span>
              <span style={{ color: "#E2445C" }}>\u26a0 {tasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
              {activeProj ? `${activeProj.icon} ${activeProj.name}` : "\ud83d\udcca Todas as Tarefas"}
            </h1>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{filteredTasks.length} tarefa{filteredTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, fontSize: 14 }}>\ud83d\udd0d</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefas..."
              style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px 8px 34px", color: theme.text, fontSize: 13, outline: "none", width: 200, fontFamily: "'DM Sans', sans-serif" }} />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px", color: theme.text, fontSize: 13, outline: "none", cursor: "pointer", colorScheme: theme.scheme, fontFamily: "'DM Sans', sans-serif" }}>
            <option value="all">Todos Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {canEdit && (
            <button onClick={addTask}
              style={{ background: "linear-gradient(135deg, #7B61FF, #579BFC)", border: "none", color: "#fff", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 16px rgba(123,97,255,0.3)" }}>
              <span style={{ fontSize: 16 }}>+</span> Nova Tarefa
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 130px 130px 110px 100px 60px 60px", padding: "10px 12px", gap: 8, borderBottom: `1px solid ${theme.borderStrong}`, fontSize: 10, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1.2, background: theme.surfaceHover }}>
          <div></div><div>Tarefa</div><div>Status</div><div>Projeto</div><div>Prazo</div><div>Prioridade</div><div style={{ textAlign: "center" }}>\ud83e\udd35</div><div></div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredTasks.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>\ud83d\udced</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma tarefa encontrada</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{canEdit ? "Clique em \"+ Nova Tarefa\" para come\u00e7ar" : "Pe\u00e7a ao admin para compartilhar projetos com voc\u00ea"}</div>
            </div>
          )}
          {filteredTasks.map((task) => (
            <div key={task.id}>
              <TaskRow task={task} projects={visibleProjects} users={users} onUpdate={updateTask} onOpen={setDetailTask} theme={theme} canEdit={canEdit} />
              {(task.subtasks || []).map((st) => (
                <TaskRow key={st.id} task={st} projects={visibleProjects} users={users} isSubtask canEdit={canEdit}
                  onUpdate={(updated: any) => { const n = task.subtasks.map((s) => (s.id === updated.id ? updated : s)); updateTask({ ...task, subtasks: n }); }}
                  onOpen={() => setDetailTask(task)} theme={theme} />
              ))}
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
