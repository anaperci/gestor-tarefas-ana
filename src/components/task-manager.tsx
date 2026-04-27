"use client";

import { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback, CSSProperties, ReactNode } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import type {
  ChecklistItem,
  Note,
  Project,
  Role,
  RoutineCheck,
  RoutineHistoryDay,
  RoutineItem,
  Subtask,
  Task,
  User,
} from "@/lib/types";

interface Group {
  id: string;
  name: string;
  color: string;
  icon: string;
  tasks: Task[];
}

const ROLES: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  admin: { label: "Admin", color: "#E2445C", icon: "👑", desc: "Acesso total. Cria usuários, projetos, gerencia tudo." },
  editor: { label: "Editor", color: "#FDAB3D", icon: "✏️", desc: "Cria e edita tarefas nos projetos compartilhados." },
  viewer: { label: "Visualizador", color: "#579BFC", icon: "👁️", desc: "Apenas visualiza tarefas e projetos compartilhados." },
};

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

const GRID_COLUMNS = "36px 1fr 120px 120px 110px 100px 140px 48px";
const GRID_COLUMNS_SUBTASK = "36px 1fr 130px 110px 60px";

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
interface DropdownOption {
  value: string;
  label: string;
  color?: string;
  bg?: string;
  icon?: string;
  name?: string;
  avatar?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  renderOption?: (option: DropdownOption, isSelected: boolean) => ReactNode;
  theme: Theme;
  disabled?: boolean;
}

function Dropdown({ options, value, onChange, renderOption, theme, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) || options[0];

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
          {options.map((opt) => (
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

interface StatusBadgeProps {
  value: string;
  onChange: (value: string) => void;
  theme: Theme;
  disabled?: boolean;
  compact?: boolean;
}

function StatusBadge({ value, onChange, compact, theme, disabled }: StatusBadgeProps) {
  return (
    <Dropdown options={STATUS_OPTIONS} value={value} onChange={onChange} theme={theme} disabled={disabled}
      renderOption={(o) => (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: theme.badgeBg(o.color || "#999"), color: o.color, borderRadius: 20,
          padding: compact ? "3px 10px" : "4px 14px", fontSize: compact ? 12 : 13,
          fontWeight: 600, border: `1px solid ${theme.badgeBorder(o.color || "#999")}`, whiteSpace: "nowrap"
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: o.color }} />
          {o.label}
        </span>
      )}
    />
  );
}

interface PriorityBadgeProps {
  value: string;
  onChange: (value: string) => void;
  theme: Theme;
  disabled?: boolean;
}

function PriorityBadge({ value, onChange, theme, disabled }: PriorityBadgeProps) {
  return (
    <Dropdown options={PRIORITY_OPTIONS} value={value} onChange={onChange} theme={theme} disabled={disabled}
      renderOption={(o) => (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: theme.badgeBg(o.bg || "#999"), color: o.bg, borderRadius: 20,
          padding: "4px 14px", fontSize: 13, fontWeight: 600,
          border: `1px solid ${theme.badgeBorder(o.bg || "#999")}`, whiteSpace: "nowrap"
        }}>{o.label}</span>
      )}
    />
  );
}

// ——— Checklist ———
interface ChecklistComponentProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  theme: Theme;
  disabled?: boolean;
}

function Checklist({ items, onChange, theme, disabled }: ChecklistComponentProps) {
  const [newItem, setNewItem] = useState("");
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const toggle = (id: string) => { if (!disabled) onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i))); };
  const remove = (id: string) => { if (!disabled) onChange(items.filter((i) => i.id !== id)); };
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
      {items.map((item) => (
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
function LoginScreen({ onLogin, theme, onToggleTheme }: { onLogin: (user: User) => void; theme: Theme; onToggleTheme: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleLogin = async () => {
    try {
      const user = await api.login(username.toLowerCase().trim(), password);
      onLogin(user);
    } catch (e) { triggerError(e instanceof Error ? e.message : "Erro no login"); }
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
          <img src="/nexia-icon.svg" alt="NexIA Tasks" style={{ width: 56, height: 56, margin: "0 auto 16px", display: "block", filter: theme.scheme === "dark" ? "invert(1) brightness(2)" : "none" }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: -0.5, margin: 0, fontFamily: "'Poppins', sans-serif" }}>NexIA <span style={{ fontWeight: 400 }}>Tasks</span></h1>
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

      </div>
    </div>
  );
}

// ——— Admin Panel ———
interface AdminPanelProps {
  users: User[];
  projects: Project[];
  tasks: Task[];
  onUpdateUsers: (users: User[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onClose: () => void;
  theme: Theme;
  currentUser: User;
}

function AdminPanel({ users, projects, onUpdateUsers, onUpdateProjects, onClose, theme, currentUser }: AdminPanelProps) {
  const [tab, setTab] = useState("users");
  const [newUser, setNewUser] = useState<{ username: string; name: string; password: string; role: Role }>({
    username: "", name: "", password: "", role: "editor",
  });

  const addUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) return;
    if (users.find((u) => u.username === newUser.username.toLowerCase().trim())) return;
    try {
      const created = await api.createUser({ username: newUser.username, name: newUser.name || newUser.username, password: newUser.password, role: newUser.role });
      onUpdateUsers([...users, { ...created }]);
    } catch {}
    setNewUser({ username: "", name: "", password: "", role: "editor" });
  };

  const resetPassword = async (userId: string, newPwd: string) => {
    try { await api.resetPassword(userId, newPwd); } catch {}
  };

  const deleteUser = async (userId: string) => {
    if (userId === currentUser.id) return;
    if (!window.confirm("Deletar este usuário?")) return;
    try {
      await api.deleteUser(userId);
      onUpdateUsers(users.filter((u) => u.id !== userId));
    } catch {}
  };

  const changeRole = async (userId: string, newRole: Role) => {
    const avatars: Record<string, string> = { admin: "👑", editor: "✏️", viewer: "👁️" };
    try {
      await api.changeRole(userId, newRole);
      onUpdateUsers(users.map((u) => u.id === userId ? { ...u, role: newRole, avatar: avatars[newRole] } : u));
    } catch {}
  };

  const toggleShare = async (projId: string, userId: string) => {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) return;
    const shared = proj.sharedWith || [];
    const newShared = shared.includes(userId) ? shared.filter((id) => id !== userId) : [...shared, userId];
    try {
      await api.updateShares(projId, newShared);
      onUpdateProjects(projects.map((p) => p.id === projId ? { ...p, sharedWith: newShared } : p));
    } catch {}
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
                    <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
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

              {users.map((user) => (
                <UserRow key={user.id} user={user} currentUser={currentUser} theme={theme}
                  onResetPassword={(pwd: string) => resetPassword(user.id, pwd)}
                  onChangeRole={(r: Role) => changeRole(user.id, r)}
                  onDelete={() => deleteUser(user.id)} />
              ))}
            </>
          )}

          {tab === "permissions" && (
            <>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                Marque os usuários que terão acesso a cada projeto. Admins sempre têm acesso total.
              </div>
              {projects.map((proj) => (
                <div key={proj.id} style={{
                  padding: 16, borderRadius: 12, border: `1px solid ${theme.border}`,
                  marginBottom: 10, background: theme.inputBg
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>{proj.icon}</span>
                    <span style={{ fontWeight: 700, color: proj.color, fontSize: 15 }}>{proj.name}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {users.filter((u) => u.role !== "admin").map((user) => {
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
interface UserRowProps {
  user: User;
  currentUser: User;
  theme: Theme;
  onResetPassword: (password: string) => void;
  onChangeRole: (role: Role) => void;
  onDelete: () => void;
}

function UserRow({ user, currentUser, theme, onResetPassword, onChangeRole, onDelete }: UserRowProps) {
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

      <select value={user.role} onChange={(e) => onChangeRole(e.target.value as Role)} disabled={isMe}
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

// ——— Rich Text Editor (Monday.com style) ———
function RichEditor({ value, onChange, theme, readOnly, placeholder }: { value: string; onChange: (v: string) => void; theme: Theme; readOnly?: boolean; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (editorRef.current && isInitialMount.current) {
      editorRef.current.innerHTML = value || "";
      isInitialMount.current = false;
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const insertLink = () => {
    const url = window.prompt("URL do link:");
    if (url) exec("createLink", url);
  };

  const insertMention = () => {
    const sel = window.getSelection();
    if (sel && editorRef.current) {
      const mention = document.createElement("span");
      mention.style.cssText = "color: #579BFC; font-weight: 600;";
      mention.textContent = "@";
      sel.getRangeAt(0).insertNode(mention);
      sel.collapseToEnd();
      editorRef.current.focus();
      handleInput();
    }
  };

  const toolBtn = (label: string, action: () => void, title: string) => (
    <button onClick={action} title={title}
      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 4, color: theme.textSecondary, fontSize: 14, fontWeight: label === "B" ? 700 : label === "I" ? 400 : 500, fontStyle: label === "I" ? "italic" : "normal", fontFamily: "'Figtree', Roboto, sans-serif", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 28, height: 28 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover; e.currentTarget.style.color = theme.text; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = theme.textSecondary; }}>
      {label}
    </button>
  );

  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, overflow: "hidden" }}>
      {!readOnly && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 10px", borderBottom: `1px solid ${theme.border}`, background: theme.inputBg }}>
          {toolBtn("B", () => exec("bold"), "Negrito")}
          {toolBtn("I", () => exec("italic"), "Itálico")}
          {toolBtn("U", () => exec("underline"), "Sublinhado")}
          <div style={{ width: 1, height: 18, background: theme.border, margin: "0 4px" }} />
          {toolBtn("🔗", insertLink, "Inserir link")}
          {toolBtn("@", insertMention, "Mencionar")}
          <div style={{ width: 1, height: 18, background: theme.border, margin: "0 4px" }} />
          {toolBtn("― ―", () => exec("insertHorizontalRule"), "Linha divisória")}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{
          padding: "14px 16px", minHeight: 120, outline: "none", color: theme.text,
          fontSize: 14, lineHeight: 1.7, fontFamily: "'Figtree', Roboto, sans-serif",
          overflowY: "auto", maxHeight: 400, cursor: readOnly ? "default" : "text",
        }}
      />
      <style>{`
        [data-placeholder]:empty:before { content: attr(data-placeholder); color: ${theme.textMuted}; pointer-events: none; }
        [contenteditable] a { color: #579BFC; text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ——— Task Detail (Monday.com style — tela única) ———
interface TaskDetailProps {
  task: Task;
  projects: Project[];
  users: User[];
  onUpdate: (task: Task) => void;
  onClose: () => void;
  theme: Theme;
  canEdit: boolean;
}

function TaskDetail({ task, projects, users, onUpdate, onClose, theme, canEdit }: TaskDetailProps) {
  const [newCheckItem, setNewCheckItem] = useState("");
  const checkInputRef = useRef<HTMLInputElement>(null);
  const assignee = users?.find((u) => u.id === task.assignedTo);
  const project = projects.find((p) => p.id === task.projectId);
  const checkDone = (task.checklist || []).filter((i) => i.done).length;
  const checkTotal = (task.checklist || []).length;
  const checkPct = checkTotal ? Math.round((checkDone / checkTotal) * 100) : 0;

  const addCheckItem = () => {
    if (!newCheckItem.trim() || !canEdit) return;
    onUpdate({ ...task, checklist: [...(task.checklist || []), { id: genId(), text: newCheckItem.trim(), done: false }] });
    setNewCheckItem("");
    setTimeout(() => checkInputRef.current?.focus(), 50);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: theme.overlay, backdropFilter: "blur(4px)" }} />
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "relative", width: "min(640px, 94vw)", height: "100%",
        background: theme.surface, display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.15)", animation: "slideIn 0.25s ease-out"
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", flexShrink: 0, borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textSecondary, cursor: "pointer", fontSize: 20, padding: 4, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, flexShrink: 0 }}
              onMouseEnter={(e) => e.currentTarget.style.background = theme.surfaceHover}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}>✕</button>
            <input value={task.title} onChange={(e) => canEdit && onUpdate({ ...task, title: e.target.value })} readOnly={!canEdit}
              style={{ flex: 1, background: "transparent", border: "none", color: theme.text, fontSize: 24, fontWeight: 700, outline: "none", fontFamily: "'Figtree', sans-serif", padding: 0, letterSpacing: -0.1, cursor: canEdit ? "text" : "default" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {assignee && (
                <div title={assignee.name} style={{ width: 34, height: 34, borderRadius: "50%", background: theme.badgeBg("#579BFC"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, border: `2px solid ${theme.border}` }}>
                  {assignee.avatar}
                </div>
              )}
              {project && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: project.color, fontWeight: 600, background: theme.badgeBg(project.color), padding: "3px 10px", borderRadius: 12 }}>
                  {project.icon} {project.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 32px" }}>
          {!canEdit && (
            <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(87,155,252,0.1)", border: "1px solid rgba(87,155,252,0.2)", color: "#579BFC", fontSize: 13, fontWeight: 500, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <span>👁️</span> Modo visualização
            </div>
          )}

          {/* Rich text description */}
          <RichEditor
            value={task.description || ""}
            onChange={(v) => canEdit && onUpdate({ ...task, description: v })}
            theme={theme}
            readOnly={!canEdit}
            placeholder={canEdit ? "Escreva aqui... Use a barra de ferramentas para formatar" : "Sem descrição"}
          />

          {/* Checklist — simple Monday.com style */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Checklist</span>
              {checkTotal > 0 && (
                <>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{checkDone}/{checkTotal}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 4, background: theme.inputBg, maxWidth: 120 }}>
                    <div style={{ width: checkPct + "%", height: "100%", borderRadius: 4, background: "#00C875", transition: "width 0.3s" }} />
                  </div>
                </>
              )}
            </div>

            {(task.checklist || []).map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
                <button onClick={() => canEdit && onUpdate({ ...task, checklist: task.checklist.map((i) => i.id === item.id ? { ...i, done: !i.done } : i) })}
                  style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${item.done ? "#00C875" : theme.textMuted}`, background: item.done ? "#00C875" : "transparent", cursor: canEdit ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, transition: "all 0.15s" }}>
                  {item.done && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                </button>
                <span style={{ flex: 1, fontSize: 14, color: item.done ? theme.textMuted : theme.text, textDecoration: item.done ? "line-through" : "none", transition: "all 0.15s" }}>{item.text}</span>
                {canEdit && <button onClick={() => onUpdate({ ...task, checklist: task.checklist.filter((i) => i.id !== item.id) })}
                  style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 16, padding: "0 4px", opacity: 0.4, transition: "opacity 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "0.4"}>×</button>}
              </div>
            ))}

            {canEdit && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px dashed ${theme.textMuted}`, opacity: 0.4, flexShrink: 0 }} />
                <input ref={checkInputRef} value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCheckItem(); }}
                  placeholder="Adicionar item..."
                  style={{ flex: 1, background: "transparent", border: "none", color: theme.text, fontSize: 14, outline: "none", fontFamily: "'Figtree', Roboto, sans-serif", padding: 0 }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Task Row ———
interface TaskRowProps {
  task: Task;
  projects: Project[];
  users: User[];
  onUpdate: (task: Task) => void;
  onOpen: (task: Task) => void;
  isSubtask?: boolean;
  theme: Theme;
  canEdit: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
}

function TaskRow({ task, projects, users, onUpdate, onOpen, isSubtask, theme, canEdit, isExpanded, onToggleExpand }: TaskRowProps) {
  const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";
  const stDone = (task.subtasks || []).filter((s) => s.checked).length;
  const stTotal = (task.subtasks || []).length;
  const assignee = users?.find((u) => u.id === task.assignedTo);

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
          <Dropdown options={projects.map((p) => ({ value: p.id, label: p.name, color: p.color, icon: p.icon, name: p.name }))} value={task.projectId} onChange={(v: string) => onUpdate({ ...task, projectId: v })} theme={theme} disabled={!canEdit}
            renderOption={(o) => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: o.color || theme.textSecondary }}>{o.icon} {o.label || o.name}</span>} />
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
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            options={[{ value: "", label: "Ninguém", avatar: "—" }, ...(users || []).map((u) => ({ value: u.id, label: u.name, avatar: u.avatar }))]}
            value={task.assignedTo || ""}
            onChange={(v: string) => canEdit && onUpdate({ ...task, assignedTo: v || null })}
            theme={theme}
            disabled={!canEdit}
            renderOption={(o, isSelected) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ flexShrink: 0 }}>{o.avatar}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{isSelected ? (o.label === "Ninguém" ? "—" : o.label) : o.label}</span>
              </span>
            )}
          />
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
function GroupHeader({ group, collapsed, onToggle, taskCount, theme, dragHandleProps }: { group: Group; collapsed: boolean; onToggle: () => void; taskCount: number; theme: Theme; dragHandleProps?: Record<string, unknown> }) {
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      borderLeft: `4px solid ${group.color}`, background: theme.surfaceHover,
      cursor: "pointer", userSelect: "none", borderBottom: `1px solid ${theme.border}`,
      borderRadius: "12px 12px 0 0"
    }}>
      {dragHandleProps && (
        <span {...dragHandleProps} onClick={(e) => e.stopPropagation()} style={{ cursor: "grab", fontSize: 14, color: theme.textMuted, padding: "2px 4px", display: "flex", alignItems: "center", opacity: 0.5 }} title="Arrastar grupo">
          ⠿
        </span>
      )}
      <span style={{ fontSize: 10, color: group.color, transition: "transform 0.2s", transform: collapsed ? "rotate(0deg)" : "rotate(90deg)", fontWeight: 700 }}>▶</span>
      <span style={{ fontSize: 16 }}>{group.icon}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: group.color }}>{group.name}</span>
      <span style={{ fontSize: 12, color: theme.textMuted, background: theme.inputBg, padding: "2px 8px", borderRadius: 10 }}>{taskCount}</span>
    </div>
  );
}

// ——— Sortable Group Wrapper ———
function SortableGroup({ id, children }: { id: string; children: (dragHandleProps: Record<string, unknown>) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : "auto",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
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

// ——— Personal Area Components ———

function StatCard({ label, value, color, theme }: { label: string; value: number; color: string; theme: Theme }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: 12, background: theme.badgeBg(color), border: `1px solid ${theme.badgeBorder(color)}`, minWidth: 100, textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

interface MyTasksTabProps {
  theme: Theme;
  currentUser: User;
  tasks: Task[];
  projects: Project[];
  users: User[];
  canEdit: boolean;
  onOpenTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
}

function MyTasksTab({ theme, currentUser, tasks, projects, users, canEdit, onOpenTask, onUpdateTask }: MyTasksTabProps) {
  const myTasks = tasks.filter((t) => t.assignedTo === currentUser.id);
  const [myCollapsed, setMyCollapsed] = useState<Set<string>>(new Set());
  const [myExpanded, setMyExpanded] = useState<Set<string>>(new Set());

  const myGroups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    myTasks.forEach((t) => {
      const proj = projects.find((p) => p.id === t.projectId);
      if (!proj) return;
      if (!map.has(proj.id)) map.set(proj.id, { id: proj.id, name: proj.name, color: proj.color, icon: proj.icon, tasks: [] });
      map.get(proj.id)!.tasks.push(t);
    });
    return Array.from(map.values());
  }, [myTasks, projects]);

  const done = myTasks.filter((t) => t.status === "done").length;
  const overdue = myTasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length;
  const doing = myTasks.filter((t) => t.status === "doing").length;

  return (
    <div>
      <div style={{ padding: "16px 24px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Total" value={myTasks.length} color="#7B61FF" theme={theme} />
        <StatCard label="Concluídas" value={done} color="#00C875" theme={theme} />
        <StatCard label="Em progresso" value={doing} color="#FDAB3D" theme={theme} />
        <StatCard label="Atrasadas" value={overdue} color="#E2445C" theme={theme} />
      </div>
      {myTasks.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Nenhuma tarefa atribuída a você</div>
        </div>
      )}
      {myGroups.map((group) => (
        <div key={group.id} style={{ marginBottom: 20, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden", background: theme.surface }}>
          <GroupHeader group={group} collapsed={myCollapsed.has(group.id)} onToggle={() => setMyCollapsed((prev) => { const n = new Set(prev); n.has(group.id) ? n.delete(group.id) : n.add(group.id); return n; })} taskCount={group.tasks.length} theme={theme} />
          {!myCollapsed.has(group.id) && (<>
            <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, padding: "10px 12px", gap: 8, borderBottom: `1px solid ${theme.borderStrong}`, fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1.2, background: theme.surfaceHover, borderLeft: `4px solid ${group.color}` }}>
              <div></div><div>Tarefa</div><div>Status</div><div>Projeto</div><div>Prazo</div><div>Prioridade</div><div>Pessoa</div><div></div>
            </div>
            {group.tasks.map((task) => (
              <div key={task.id} style={{ borderLeft: `4px solid ${group.color}` }}>
                <TaskRow task={task} projects={projects} users={users} onUpdate={onUpdateTask} onOpen={onOpenTask} theme={theme} canEdit={canEdit} isExpanded={myExpanded.has(task.id)} onToggleExpand={(id: string) => setMyExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })} />
              </div>
            ))}
          </>)}
        </div>
      ))}
    </div>
  );
}

function RichTextToolbar({ theme }: { theme: Theme }) {
  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); };
  const insertLink = () => { const url = prompt("URL do link:"); if (url) exec("createLink", url); };
  const btns = [
    { label: "B", cmd: "bold", s: { fontWeight: 700 } as React.CSSProperties },
    { label: "I", cmd: "italic", s: { fontStyle: "italic" } as React.CSSProperties },
    { label: "U", cmd: "underline", s: { textDecoration: "underline" } as React.CSSProperties },
    { label: "• Lista", cmd: "insertUnorderedList", s: {} as React.CSSProperties },
    { label: "1. Lista", cmd: "insertOrderedList", s: {} as React.CSSProperties },
    { label: "🔗 Link", cmd: "link", s: {} as React.CSSProperties },
  ];
  return (
    <div style={{ padding: "8px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
      {btns.map((b) => (
        <button key={b.cmd} onMouseDown={(e) => { e.preventDefault(); b.cmd === "link" ? insertLink() : exec(b.cmd); }}
          style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, cursor: "pointer", fontSize: 12, fontFamily: "'Figtree', sans-serif", ...b.s }}>
          {b.label}
        </button>
      ))}
    </div>
  );
}

function NotesTab({ theme }: { theme: Theme; currentUser: User }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchNotes, setSearchNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => { loadNotes(); return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }; }, []);

  const loadNotes = async () => { setLoading(true); try { const data = await api.getNotes(); setNotes(data); } catch {} finally { setLoading(false); } };

  const createNote = async () => {
    try {
      const n = await api.createNote({ title: "Nova nota", content: "" });
      setNotes((prev) => [n, ...prev]);
      setSelectedNote(n);
    } catch {}
  };

  const saveNote = async (note: Note | null) => {
    if (!note || !isDirtyRef.current) return;
    isDirtyRef.current = false;
    try {
      const updated = await api.updateNote(note.id, { title: note.title, content: note.content, pinned: note.pinned });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch {}
  };

  const scheduleAutosave = (note: Note) => {
    isDirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNote(note), 1500);
  };

  const deleteNote = async (id: string) => {
    try { await api.deleteNote(id); setNotes((prev) => prev.filter((n) => n.id !== id)); } catch {}
  };

  const togglePin = async (note: Note) => {
    const newPinned = !note.pinned;
    try {
      const updated = await api.updateNote(note.id, { pinned: newPinned });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      if (selectedNote?.id === note.id) setSelectedNote({ ...selectedNote, pinned: newPinned });
    } catch {}
  };

  const filteredNotes = notes.filter((n) => !searchNotes || n.title.toLowerCase().includes(searchNotes.toLowerCase()) || (n.content || "").replace(/<[^>]*>/g, "").toLowerCase().includes(searchNotes.toLowerCase()));

  if (selectedNote) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => { saveNote(selectedNote); setSelectedNote(null); }}
            style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "6px 14px", color: theme.text, cursor: "pointer", fontSize: 13, fontFamily: "'Figtree', sans-serif" }}>← Voltar</button>
          <input value={selectedNote.title} onChange={(e) => { const u = { ...selectedNote, title: e.target.value }; setSelectedNote(u); scheduleAutosave(u); }}
            style={{ flex: 1, fontSize: 20, fontWeight: 700, background: "transparent", border: "none", color: theme.text, outline: "none", fontFamily: "'Figtree', sans-serif" }} />
          <button onMouseDown={(e) => { e.preventDefault(); togglePin(selectedNote); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: selectedNote.pinned ? 1 : 0.4 }}>📌</button>
          <button onClick={() => { deleteNote(selectedNote.id); setSelectedNote(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#E2445C" }}>🗑️</button>
        </div>
        <RichTextToolbar theme={theme} />
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onInput={() => { if (editorRef.current) { const u = { ...selectedNote, content: editorRef.current.innerHTML }; setSelectedNote(u); scheduleAutosave(u); } }}
          dangerouslySetInnerHTML={{ __html: selectedNote.content }}
          style={{ padding: "20px 24px", flex: 1, outline: "none", color: theme.text, fontSize: 14, lineHeight: 1.8, fontFamily: "'Figtree', sans-serif", overflowY: "auto", minHeight: 200 }}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, fontSize: 14 }}>🔍</span>
          <input value={searchNotes} onChange={(e) => setSearchNotes(e.target.value)} placeholder="Buscar anotações..."
            style={{ width: "100%", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px 8px 34px", color: theme.text, fontSize: 14, outline: "none", fontFamily: "'Figtree', sans-serif" }} />
        </div>
        <button onClick={createNote}
          style={{ background: "linear-gradient(135deg, #7B61FF, #579BFC)", border: "none", color: "#fff", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px rgba(123,97,255,0.3)", whiteSpace: "nowrap" }}>
          + Nova Anotação
        </button>
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Carregando...</div>
      ) : filteredNotes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{searchNotes ? "Nenhuma nota encontrada" : "Nenhuma anotação ainda"}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Clique em &quot;+ Nova Anotação&quot; para começar</div>
        </div>
      ) : (
        <div style={{ padding: "0 24px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {filteredNotes.map((note) => (
            <div key={note.id} onClick={() => setSelectedNote(note)}
              style={{ padding: 16, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {note.pinned && <span>📌</span>}
                <span style={{ fontSize: 15, fontWeight: 700, color: theme.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title || "Sem título"}</span>
              </div>
              <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.5, maxHeight: 60, overflow: "hidden" }}>
                {(note.content || "").replace(/<[^>]*>/g, "").slice(0, 120) || "Nota vazia..."}
              </div>
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 8 }}>{new Date(note.updatedAt).toLocaleDateString("pt-BR")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutineTab({ theme }: { theme: Theme; currentUser: User }) {
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [checks, setChecks] = useState<Pick<RoutineCheck, "routineItemId" | "checkDate">[]>([]);
  const [history, setHistory] = useState<RoutineHistoryDay[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const today = new Date().toLocaleDateString("en-CA");
  const todayFormatted = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => { loadRoutines(); loadHistory(); }, []);

  const loadRoutines = async () => { setLoading(true); try { const data = await api.getRoutines(today); setItems(data.items); setChecks(data.checks); } catch {} finally { setLoading(false); } };
  const loadHistory = async () => { try { const data = await api.getRoutineHistory(7); setHistory(data.history); } catch {} };

  const isChecked = (itemId: string) => checks.some((c) => c.routineItemId === itemId);

  const toggleCheck = async (itemId: string) => {
    const wasChecked = isChecked(itemId);
    if (wasChecked) {
      setChecks(checks.filter((c) => c.routineItemId !== itemId));
    } else {
      setChecks([...checks, { routineItemId: itemId, checkDate: today }]);
    }
    await api.toggleRoutineCheck(itemId, today);
    loadHistory();
  };

  const addItem = async () => {
    if (!newTitle.trim()) return;
    try { const created = await api.createRoutineItem({ title: newTitle.trim() }); setItems([...items, created]); setNewTitle(""); loadHistory(); } catch {}
  };

  const deleteItem = async (id: string) => {
    try { await api.deleteRoutineItem(id); setItems(items.filter((i) => i.id !== id)); setChecks(checks.filter((c) => c.routineItemId !== id)); loadHistory(); } catch {}
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    try { const updated = await api.updateRoutineItem(id, { title: editTitle.trim() }); setItems(items.map((i) => (i.id === updated.id ? updated : i))); } catch {}
    setEditingId(null);
  };

  const completedToday = checks.length;
  const totalItems = items.length;
  const pct = totalItems > 0 ? Math.round((completedToday / totalItems) * 100) : 0;

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>Carregando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: theme.textMuted, textTransform: "capitalize" }}>{todayFormatted}</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: pct === 100 ? "#00C875" : "#7B61FF", marginTop: 4 }}>{pct}%</div>
        <div style={{ maxWidth: 300, margin: "8px auto 0", height: 6, borderRadius: 6, background: theme.inputBg }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: pct === 100 ? "#00C875" : "#7B61FF", transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>{completedToday} de {totalItems} concluídos</div>
      </div>

      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: 30, color: theme.textMuted }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🔄</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum item na rotina</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Adicione itens abaixo para começar</div>
          </div>
        )}
        {items.map((item) => {
          const checked = isChecked(item.id);
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, border: `1px solid ${theme.border}`, marginBottom: 6, background: checked ? theme.badgeBg("#00C875") : "transparent", transition: "all 0.15s" }}>
              <button onClick={() => toggleCheck(item.id)}
                style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${checked ? "#00C875" : theme.textMuted}`, background: checked ? "#00C875" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>
                {checked && <span style={{ color: "#fff", fontSize: 13 }}>✓</span>}
              </button>
              {editingId === item.id ? (
                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={() => saveEdit(item.id)} onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                  style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "4px 8px", color: theme.text, fontSize: 14, outline: "none", fontFamily: "'Figtree', sans-serif" }} />
              ) : (
                <span onClick={() => { setEditingId(item.id); setEditTitle(item.title); }}
                  style={{ flex: 1, fontSize: 14, fontWeight: 500, color: checked ? theme.textMuted : theme.text, textDecoration: checked ? "line-through" : "none", cursor: "text" }}>{item.title}</span>
              )}
              <button onClick={() => deleteItem(item.id)}
                style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 16, opacity: 0.4, flexShrink: 0 }}>×</button>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="Adicionar item à rotina..."
            style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 8, padding: "10px 14px", color: theme.text, fontSize: 13, outline: "none", fontFamily: "'Figtree', sans-serif" }} />
          <button onClick={addItem} style={{ background: "#7B61FF", border: "none", borderRadius: 8, color: "#fff", padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>+</button>
        </div>
      </div>

      {history.length > 0 && (
        <div style={{ maxWidth: 500, margin: "24px auto 0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.textSecondary, marginBottom: 10 }}>Últimos 7 dias</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
            {history.map((day) => {
              const dayPct = day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0;
              const isToday = day.date === today;
              return (
                <div key={day.date} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 10, color: isToday ? "#7B61FF" : theme.textMuted, fontWeight: isToday ? 700 : 400, marginBottom: 4 }}>
                    {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}
                  </div>
                  <div style={{ height: 40, borderRadius: 6, background: theme.inputBg, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${dayPct}%`, background: dayPct === 100 ? "#00C875" : "#7B61FF", borderRadius: 6, transition: "height 0.3s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{dayPct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface PersonalAreaProps {
  theme: Theme;
  currentUser: User;
  tasks: Task[];
  projects: Project[];
  users: User[];
  personalTab: "minhas-tarefas" | "anotacoes" | "rotina";
  onTabChange: (tab: "minhas-tarefas" | "anotacoes" | "rotina") => void;
  canEdit: boolean;
  onOpenTask: (task: Task) => void;
  onUpdateTask: (task: Task) => void;
}

function PersonalArea({ theme, currentUser, tasks, projects, users, personalTab, onTabChange, canEdit, onOpenTask, onUpdateTask }: PersonalAreaProps) {
  const tabs: { key: PersonalAreaProps["personalTab"]; label: string }[] = [
    { key: "minhas-tarefas", label: "📋 Minhas Tarefas" },
    { key: "anotacoes", label: "📝 Anotações" },
    { key: "rotina", label: "🔄 Rotina" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${theme.border}` }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>👤 Minha Área</h1>
        <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{currentUser.name}</p>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "0 24px", borderBottom: `1px solid ${theme.border}` }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => onTabChange(t.key)}
            style={{ padding: "12px 20px", border: "none", borderBottom: personalTab === t.key ? "2px solid #7B61FF" : "2px solid transparent", background: "transparent", color: personalTab === t.key ? "#7B61FF" : theme.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Figtree', sans-serif", transition: "all 0.15s", marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {personalTab === "minhas-tarefas" && <MyTasksTab theme={theme} currentUser={currentUser} tasks={tasks} projects={projects} users={users} canEdit={canEdit} onOpenTask={onOpenTask} onUpdateTask={onUpdateTask} />}
        {personalTab === "anotacoes" && <NotesTab theme={theme} currentUser={currentUser} />}
        {personalTab === "rotina" && <RoutineTab theme={theme} currentUser={currentUser} />}
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

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProject, setActiveProject] = useState("all");
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdmin, setShowAdmin] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<"tasks" | "personal">("tasks");
  const [personalTab, setPersonalTab] = useState<"minhas-tarefas" | "anotacoes" | "rotina">("minhas-tarefas");
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexia-group-order");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "error" | "success" }[]>([]);

  const showToast = useCallback((message: string, type: "error" | "success" = "error") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
    const unsorted = Array.from(groupMap.values());
    if (groupOrder.length === 0) return unsorted;
    return unsorted.sort((a, b) => {
      const ai = groupOrder.indexOf(a.id);
      const bi = groupOrder.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [filteredTasks, activeProject, projects, groupOrder]);

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = groups.map((g) => g.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    setGroupOrder(newOrder);
    localStorage.setItem("nexia-group-order", JSON.stringify(newOrder));
  };

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
    try {
      const [u, p, t] = await Promise.all([api.getUsers(), api.getProjects(), api.getTasks()]);
      setUsers(u);
      setProjects(p.map((x) => ({ ...x, sharedWith: x.sharedWith || [] })));
      setTasks(t);
    } catch { showToast("Erro ao carregar dados"); }
  }, []);

  // Auto-login from saved token
  useEffect(() => {
    if (currentUser) return;
    if (api.hasToken()) {
      api.me().then((u) => { setCurrentUser(u); }).catch(() => api.logout());
    }
  }, [currentUser]);

  useEffect(() => { if (currentUser) loadData(); }, [currentUser, loadData]);

  const updateTask = async (updated: Task) => {
    if (!canEdit) return;
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (detailTask && detailTask.id === updated.id) setDetailTask(updated);
    try { await api.updateTask(updated.id, { title: updated.title, description: updated.description, status: updated.status, priority: updated.priority, deadline: updated.deadline, projectId: updated.projectId, assignedTo: updated.assignedTo, link: updated.link, checked: updated.checked, checklist: updated.checklist, subtasks: updated.subtasks }); } catch { showToast("Erro ao salvar tarefa"); }
  };

  const addTask = async () => {
    if (!canEdit || !currentUser) return;
    const projectId = activeProject === "all" ? visibleProjects[0]?.id : activeProject;
    if (!projectId) { showToast("Nenhum projeto disponível. Peça ao admin para compartilhar um projeto com você."); return; }
    try {
      const nt = await api.createTask({ title: "Nova tarefa", status: "todo", priority: "medium", projectId, assignedTo: currentUser.id });
      setTasks((prev) => [nt, ...prev]);
      setDetailTask(nt);
    } catch { showToast("Erro ao criar tarefa"); }
  };

  const addTaskInline = async (title: string, projectId: string) => {
    if (!canEdit || !currentUser) return;
    try {
      const nt = await api.createTask({ title, status: "todo", priority: "medium", projectId, assignedTo: currentUser.id });
      setTasks((prev) => [...prev, nt]);
    } catch { showToast("Erro ao criar tarefa"); }
  };

  const addProject = async () => {
    if (!newProjectName.trim() || !isAdmin || !currentUser) return;
    const colors = ["#7B61FF", "#00C875", "#FF6B6B", "#FDAB3D", "#579BFC", "#FF78CB", "#9B59B6", "#1ABC9C"];
    const icons = ["📌", "⚡", "💡", "🎯", "🔥", "🌟", "🚀", "🌐"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const icon = icons[Math.floor(Math.random() * icons.length)];
    try {
      const np = await api.createProject({ name: newProjectName.trim(), color, icon });
      setProjects((prev) => [...prev, { ...np, ownerId: np.ownerId || currentUser.id, sharedWith: np.sharedWith || [] }]);
    } catch { showToast("Erro ao criar projeto"); }
    setNewProjectName(""); setShowNewProject(false);
  };

  const deleteProject = async (projId: string) => {
    if (!isAdmin) return;
    const proj = projects.find((p) => p.id === projId);
    const taskCount = tasks.filter((t) => t.projectId === projId).length;
    if (!window.confirm(`Apagar "${proj?.name}"${taskCount > 0 ? ` e suas ${taskCount} tarefa${taskCount > 1 ? "s" : ""}` : ""}?`)) return;
    try {
      await api.deleteProject(projId);
      setProjects((prev) => prev.filter((p) => p.id !== projId));
      setTasks((prev) => prev.filter((t) => t.projectId !== projId));
      if (activeProject === projId) setActiveProject("all");
      showToast(`Projeto "${proj?.name}" apagado`, "success");
    } catch { showToast("Erro ao apagar projeto"); }
  };

  const counts: Record<string, number> = { all: filteredTasks.length };
  visibleProjects.forEach((p) => { counts[p.id] = tasks.filter((t) => t.projectId === p.id).length; });
  const activeProj = projects.find((p) => p.id === activeProject);

  const handleLogin = async (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    api.logout();
    setUsers([]);
    setProjects([]);
    setTasks([]);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} theme={theme} onToggleTheme={() => setMode(mode === "dark" ? "light" : "dark")} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Figtree', Roboto, sans-serif", fontSize: 14, lineHeight: 1.43, background: theme.bg, color: theme.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300..900&family=Poppins:wght@600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.scrollThumb}; border-radius: 10px; }
        .task-row:hover { background: ${theme.surfaceHover} !important; }
        .sidebar-item { transition: all 0.15s; border: none; cursor: pointer; width: 100%; text-align: left; font-family: 'Figtree', Roboto, sans-serif; }
        .sidebar-item:hover { background: ${theme.surfaceHover} !important; }
        .sidebar-item:hover .proj-menu-btn { opacity: 0.6 !important; }
        .sidebar-item:hover .proj-count { opacity: 0 !important; position: absolute !important; }
        .sidebar-item .proj-menu-btn:hover { opacity: 1 !important; color: #E2445C !important; }
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
              <img src="/nexia-icon.svg" alt="NexIA Tasks" style={{ width: 34, height: 34, filter: mode === "dark" ? "invert(1) brightness(2)" : "none" }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5, fontFamily: "'Poppins', sans-serif" }}>NexIA <span style={{ fontWeight: 400 }}>Tasks</span></div>
                <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 400 }}>Gestor de Tarefas</div>
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
              <div style={{ fontSize: 12, color: ROLES[currentUser.role].color, fontWeight: 600 }}>{ROLES[currentUser.role].icon} {ROLES[currentUser.role].label}</div>
            </div>
            <button onClick={handleLogout} title="Sair"
              style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14 }}>🚪</button>
          </div>
        </div>

        <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
          <button className="sidebar-item" onClick={() => { setActiveView("personal"); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 10, fontSize: 14, fontWeight: 600, background: activeView === "personal" ? theme.badgeBg("#7B61FF") : "transparent", color: activeView === "personal" ? "#7B61FF" : theme.textSecondary, width: "100%", border: "none", cursor: "pointer", fontFamily: "'Figtree', sans-serif", textAlign: "left" }}>
            <span style={{ fontSize: 16 }}>👤</span><span style={{ flex: 1 }}>Minha Área</span>
          </button>

          <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", padding: "0 8px", marginBottom: 8 }}>Projetos</div>

          <button className="sidebar-item" onClick={() => { setActiveView("tasks"); setActiveProject("all"); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: 500, background: activeProject === "all" ? theme.badgeBg("#7B61FF") : "transparent", color: activeProject === "all" ? "#7B61FF" : theme.textSecondary }}>
            <span style={{ fontSize: 16 }}>📊</span><span style={{ flex: 1 }}>Todos</span>
            <span style={{ fontSize: 12, color: theme.textMuted, background: theme.inputBg, padding: "2px 8px", borderRadius: 10 }}>{counts.all}</span>
          </button>

          {visibleProjects.map((proj) => (
            <div key={proj.id} className="sidebar-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: 500, background: activeProject === proj.id ? theme.badgeBg(proj.color) : "transparent", color: activeProject === proj.id ? proj.color : theme.textSecondary, cursor: "pointer", position: "relative" }}
              onClick={() => { setActiveView("tasks"); setActiveProject(proj.id); }}>
              <span style={{ fontSize: 16 }}>{proj.icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
              <span className="proj-count" style={{ fontSize: 12, color: theme.textMuted, background: theme.inputBg, padding: "2px 8px", borderRadius: 10, transition: "opacity 0.15s" }}>{counts[proj.id] || 0}</span>
              {isAdmin && (
                <button onClick={(e) => { e.stopPropagation(); deleteProject(proj.id); }}
                  className="proj-menu-btn"
                  style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 16, padding: "0 4px", borderRadius: 4, opacity: 0, transition: "opacity 0.15s", letterSpacing: 1, lineHeight: 1, fontWeight: 700 }}
                  title={`Apagar ${proj.name}`}>
                  ···
                </button>
              )}
            </div>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.textMuted }}>
              <span>Total: <b style={{ color: theme.text }}>{filteredTasks.length}</b></span>
              <span style={{ color: "#00C875" }}>✓ {tasks.filter((t) => t.status === "done").length}</span>
              <span style={{ color: "#E2445C" }}>⚠ {tasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {activeView === "tasks" ? (<>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
              {activeProj ? `${activeProj.icon} ${activeProj.name}` : "📊 Todas as Tarefas"}
            </h1>
            <p style={{ fontSize: 14, color: theme.textMuted, marginTop: 2 }}>{filteredTasks.length} tarefa{filteredTasks.length !== 1 ? "s" : ""}</p>
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

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
          {filteredTasks.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: theme.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Nenhuma tarefa encontrada</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{canEdit ? "Clique em \"+ Nova Tarefa\" para começar" : "Peça ao admin para compartilhar projetos com você"}</div>
            </div>
          )}
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {groups.map((group) => (
                <SortableGroup key={group.id} id={group.id}>
                  {(dragHandleProps) => (
                    <div style={{ marginBottom: 20, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden", background: theme.surface }}>
                      <GroupHeader group={group} collapsed={collapsedGroups.has(group.id)} onToggle={() => toggleCollapseGroup(group.id)} taskCount={group.tasks.length} theme={theme} dragHandleProps={dragHandleProps} />
                      {!collapsedGroups.has(group.id) && (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, padding: "10px 12px", gap: 8, borderBottom: `1px solid ${theme.borderStrong}`, fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.8, background: theme.surfaceHover, borderLeft: `4px solid ${group.color}` }}>
                            <div></div><div>Tarefa</div><div>Status</div><div>Projeto</div><div>Prazo</div><div>Prioridade</div><div>Pessoa</div><div></div>
                          </div>
                          {group.tasks.map((task) => (
                            <div key={task.id} style={{ borderLeft: `4px solid ${group.color}` }}>
                              <TaskRow task={task} projects={visibleProjects} users={users} onUpdate={updateTask} onOpen={setDetailTask} theme={theme} canEdit={canEdit} isExpanded={expandedTasks.has(task.id)} onToggleExpand={toggleExpandTask} />
                              {expandedTasks.has(task.id) && (task.subtasks || []).map((st) => {
                                // Adapta Subtask para o shape de Task (TaskRow só mostra title/status/checked quando isSubtask)
                                const stAsTask: Task = { ...task, id: st.id, title: st.title, status: st.status, checked: st.checked, subtasks: [], checklist: [] };
                                return (
                                  <TaskRow key={st.id} task={stAsTask} projects={visibleProjects} users={users} isSubtask canEdit={canEdit}
                                    onUpdate={(updated) => {
                                      const n: Subtask[] = task.subtasks.map((s) =>
                                        s.id === updated.id ? { id: s.id, title: updated.title, status: updated.status, checked: updated.checked } : s
                                      );
                                      updateTask({ ...task, subtasks: n });
                                    }}
                                    onOpen={() => setDetailTask(task)} theme={theme} />
                                );
                              })}
                            </div>
                          ))}
                          {canEdit && <div style={{ borderLeft: `4px solid ${group.color}`, borderRadius: "0 0 12px 0" }}><InlineAddRow groupProjectId={group.id} theme={theme} onAdd={addTaskInline} /></div>}
                        </>
                      )}
                    </div>
                  )}
                </SortableGroup>
              ))}
            </SortableContext>
          </DndContext>
        </div>
        </>) : (
          <PersonalArea theme={theme} currentUser={currentUser} tasks={tasks} projects={visibleProjects} users={users} personalTab={personalTab} onTabChange={setPersonalTab} canEdit={canEdit} onOpenTask={setDetailTask} onUpdateTask={updateTask} />
        )}
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

      {/* Toast notifications */}
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: t.type === "error" ? "rgba(226,68,92,0.95)" : "rgba(0,200,117,0.95)",
            color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            animation: "fadeUp 0.25s ease-out", fontFamily: "'Figtree', sans-serif"
          }}>
            {t.type === "error" ? "⚠️" : "✓"} {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
