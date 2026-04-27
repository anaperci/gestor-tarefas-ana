"use client";

import { useState, useEffect, useRef, useMemo, useLayoutEffect, createContext, useContext, useCallback, CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LogOut, Moon, Plus, Search, Settings, Sun, User as UserIcon,
  LayoutGrid, Trash2, KeyRound, Shield, Pencil, Eye,
  Inbox, FileText, Repeat, ListChecks, Menu as MenuIcon, X,
  Link2, LayoutDashboard, List, KanbanSquare,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import { ShortcutsHelp } from "@/components/ui/shortcuts-help";
import { LoginScreen } from "@/components/login/login-screen";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { useKeyboardShortcuts, type Shortcut } from "@/lib/use-keyboard-shortcuts";
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

/** Ícone wordmark — branco serve no dark, mix-blend pra ficar visível no light. */
function OrdumLogo({ height = 28, mode, forceWhite }: { height?: number; mode: "dark" | "light"; forceWhite?: boolean }) {
  // forceWhite: usado na sidebar (que é roxa nos dois temas) → sempre logo branco
  const src = forceWhite || mode === "dark"
    ? "/logos/ordum-wordmark-branco.svg"
    : "/logos/ordum-wordmark-roxo.svg";
  return <img src={src} alt="Ordum" style={{ height, width: "auto", display: "block" }} />;
}

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

// 9 colunas: check · título · status · projeto · prazo · prioridade · pessoa · link · chevron
// 9 colunas — coluna Tarefa limitada para não esticar demais em monitores largos
const GRID_COLUMNS = "36px minmax(220px, 380px) 120px 120px 110px 100px 140px 70px 48px";
const GRID_COLUMNS_SUBTASK = "36px 1fr 130px 110px 60px";

// ——— Theme ———
// Após a Leva C, todos os valores apontam para CSS custom properties em
// globals.css. O `mode` ("dark"|"light") só afeta `scheme` (e o atributo
// data-theme no <html>) — o restante muda automaticamente via CSS.
interface Theme {
  bg: string; sidebar: string; surface: string; surfaceHover: string;
  border: string; borderStrong: string; text: string; textSecondary: string; textMuted: string;
  inputBg: string; inputBorder: string; dropdownBg: string; dropdownHover: string;
  badgeBg: (c: string) => string; badgeBorder: (c: string) => string;
  scrollThumb: string; overlay: string; scheme: "dark" | "light";
  loginBg: string; cardBg: string; cardBorder: string;
}

function getTheme(mode: "dark" | "light"): Theme {
  // Opacidade do badge varia entre temas (mais claro no dark, mais sutil no light)
  const badgeAlpha = mode === "dark" ? "22" : "15";
  const badgeBorderAlpha = mode === "dark" ? "44" : "30";
  return {
    bg: "var(--bg)",
    sidebar: "var(--sidebar)",
    surface: "var(--surface)",
    surfaceHover: "var(--surface-hover)",
    border: "var(--border)",
    borderStrong: "var(--border-strong)",
    text: "var(--text)",
    textSecondary: "var(--text-secondary)",
    textMuted: "var(--text-muted)",
    inputBg: "var(--input-bg)",
    inputBorder: "var(--input-border)",
    dropdownBg: "var(--dropdown-bg)",
    dropdownHover: "var(--dropdown-hover)",
    badgeBg: (c: string) => c + badgeAlpha,
    badgeBorder: (c: string) => c + badgeBorderAlpha,
    scrollThumb: "var(--scroll-thumb)",
    overlay: "var(--overlay)",
    scheme: mode,
    loginBg: "var(--bg)",
    cardBg: "var(--surface)",
    cardBorder: "var(--border)",
  };
}

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
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) || options[0];

  // Reposiciona ao abrir
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 160);
    const menuHeight = options.length * 36 + 12;
    // Se passa do bottom da viewport, abre pra cima
    const flipUp = rect.bottom + 4 + menuHeight > window.innerHeight - 12;
    const top = flipUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
    // Se passa da direita, alinha pela direita
    const left = rect.left + menuWidth > window.innerWidth - 12
      ? Math.max(8, window.innerWidth - menuWidth - 12)
      : rect.left;
    setPos({ top, left, minWidth: menuWidth });
  }, [open, options.length]);

  // Fecha ao clicar fora, scrollar ou redimensionar
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen((o) => !o); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ background: "none", border: "none", padding: 0, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
      >
        {renderOption ? renderOption(selected, true) : selected.label}
      </button>

      {open && !disabled && pos && typeof window !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{
            position: "fixed",
            top: pos.top, left: pos.left, minWidth: pos.minWidth,
            zIndex: 9999,
            background: theme.dropdownBg, borderRadius: 10, padding: 4,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: `1px solid ${theme.border}`,
            animation: "fadeIn 0.12s ease-out",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
              style={{
                display: "block", width: "100%", padding: "8px 12px", border: "none",
                background: opt.value === value ? theme.dropdownHover : "transparent",
                color: theme.text, borderRadius: 7, cursor: "pointer", textAlign: "left", fontSize: 13,
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = opt.value === value ? theme.dropdownHover : "transparent")}
            >
              {renderOption ? renderOption(opt, false) : opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
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
            style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "6px 10px", color: theme.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <button onClick={add} style={{ background: "var(--primary)", border: "none", borderRadius: 6, color: "#fff", padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>+</button>
        </div>
      )}
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
  const [confirm, setConfirm] = useState<{ title: string; description?: string; onConfirm: () => void | Promise<void> } | null>(null);

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

  const deleteUser = (userId: string) => {
    if (userId === currentUser.id) return;
    const target = users.find((u) => u.id === userId);
    setConfirm({
      title: `Remover ${target?.name ?? "usuário"}?`,
      description: "O usuário será arquivado e perderá o acesso. Suas tarefas e projetos compartilhados continuam preservados.",
      onConfirm: async () => {
        try {
          await api.deleteUser(userId);
          onUpdateUsers(users.filter((u) => u.id !== userId));
        } catch {}
        setConfirm(null);
      },
    });
  };

  const changeRole = async (userId: string, newRole: Role) => {
    const avatars: Record<string, string> = { admin: "👑", editor: "✏️", viewer: "👁️" };
    try {
      await api.changeRole(userId, newRole);
      // Mantém avatar custom se já não for emoji default; emoji só é trocado se ainda for
      onUpdateUsers(users.map((u) => {
        if (u.id !== userId) return u;
        const isDefaultRoleAvatar = u.avatar === "👑" || u.avatar === "✏️" || u.avatar === "👁️";
        return { ...u, role: newRole, avatar: isDefaultRoleAvatar ? avatars[newRole] : u.avatar };
      }));
    } catch {}
  };

  const changeAvatar = async (userId: string, avatar: string) => {
    try {
      await api.updateAvatar(userId, avatar);
      onUpdateUsers(users.map((u) => u.id === userId ? { ...u, avatar } : u));
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
    padding: "8px 12px", color: theme.text, fontSize: 13, outline: "none", fontFamily: "inherit"
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Painel administrativo" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: theme.overlay, backdropFilter: "blur(6px)" }} />
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "relative", width: "min(720px, 94vw)", maxHeight: "85vh",
        background: theme.surface, borderRadius: 20, overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)", animation: "fadeUp 0.25s ease-out",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ padding: "24px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: theme.text, margin: 0, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 10 }}>
              <Settings size={20} aria-hidden /> Painel Admin
            </h2>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Gerenciar usuários e permissões</p>
          </div>
          <button onClick={onClose} style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "16px 28px 0", borderBottom: `1px solid ${theme.border}` }}>
          {[{ key: "users", label: "👥 Usuários" }, { key: "permissions", label: "🔐 Permissões" }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 20px", border: "none", borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent",
              background: "transparent", color: tab === t.key ? "var(--primary)" : theme.textSecondary,
              fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
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
                    background: "var(--primary)", border: "none", color: "#fff", borderRadius: 8,
                    padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
                  }}>+ Criar</button>
                </div>
              </div>

              {users.map((user) => (
                <UserRow key={user.id} user={user} currentUser={currentUser} theme={theme}
                  onResetPassword={(pwd: string) => resetPassword(user.id, pwd)}
                  onChangeRole={(r: Role) => changeRole(user.id, r)}
                  onChangeAvatar={(seed: string) => changeAvatar(user.id, seed)}
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
                            cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
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

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel="Remover"
        destructive
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
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
  onChangeAvatar: (avatar: string) => void;
  onDelete: () => void;
}

function UserRow({ user, currentUser, theme, onResetPassword, onChangeRole, onChangeAvatar, onDelete }: UserRowProps) {
  const [showReset, setShowReset] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const isMe = user.id === currentUser.id;
  const role = ROLES[user.role];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      borderRadius: 12, border: `1px solid ${theme.border}`, marginBottom: 6,
      background: isMe ? theme.badgeBg("var(--primary)") : "transparent"
    }}>
      <button
        onClick={() => setShowAvatarPicker(true)}
        aria-label={`Editar avatar de ${user.name}`}
        title="Trocar avatar"
        style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", borderRadius: "50%" }}
      >
        <UserAvatar avatar={user.avatar} name={user.name} size={36} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
          {user.name} {isMe && <span style={{ fontSize: 10, color: "var(--primary)" }}>(você)</span>}
        </div>
        <div style={{ fontSize: 12, color: theme.textMuted }}>@{user.username}</div>
      </div>

      <select value={user.role} onChange={(e) => onChangeRole(e.target.value as Role)} disabled={isMe}
        style={{
          background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
          padding: "5px 8px", color: role.color, fontSize: 12, fontWeight: 600, outline: "none",
          cursor: isMe ? "default" : "pointer", colorScheme: theme.scheme, fontFamily: "inherit"
        }}>
        {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
      </select>

      {showReset ? (
        <div style={{ display: "flex", gap: 4 }}>
          <input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Nova senha"
            style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "5px 8px", color: theme.text, fontSize: 12, outline: "none", width: 120, fontFamily: "inherit" }} />
          <button onClick={() => { if (newPwd.trim()) { onResetPassword(newPwd); setShowReset(false); setNewPwd(""); } }}
            style={{ background: "#00C875", border: "none", color: "#fff", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✓</button>
          <button onClick={() => setShowReset(false)}
            style={{ background: theme.inputBg, border: "none", color: theme.textMuted, borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setShowReset(true)}
          style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "5px 12px", color: theme.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
          🔑 Reset
        </button>
      )}

      {!isMe && (
        <button onClick={onDelete}
          style={{ background: "rgba(226,68,92,0.1)", border: "1px solid rgba(226,68,92,0.2)", borderRadius: 8, padding: "5px 10px", color: "#E2445C", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
          🗑️
        </button>
      )}

      <AvatarPicker
        open={showAvatarPicker}
        currentAvatar={user.avatar}
        userName={user.name}
        onCancel={() => setShowAvatarPicker(false)}
        onSelect={(seed) => { onChangeAvatar(seed); setShowAvatarPicker(false); }}
      />
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
      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 4, color: theme.textSecondary, fontSize: 14, fontWeight: label === "B" ? 700 : label === "I" ? 400 : 500, fontStyle: label === "I" ? "italic" : "normal", fontFamily: "inherit", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 28, height: 28 }}
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
          fontSize: 14, lineHeight: 1.7, fontFamily: "inherit",
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
    <div role="dialog" aria-modal="true" aria-label={`Detalhes da tarefa: ${task.title}`} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
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
              style={{ flex: 1, background: "transparent", border: "none", color: theme.text, fontSize: 24, fontWeight: 700, outline: "none", fontFamily: "inherit", padding: 0, letterSpacing: -0.1, cursor: canEdit ? "text" : "default" }} />
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
                  style={{ flex: 1, background: "transparent", border: "none", color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit", padding: 0 }} />
              </div>
            )}
          </div>

          {/* Subtarefas — bloco separado abaixo do checklist */}
          <SubtasksBlock task={task} canEdit={canEdit} theme={theme} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  );
}

// ——— Subtasks Block (dentro do TaskDetail) ———
function SubtasksBlock({ task, canEdit, theme, onUpdate }: { task: Task; canEdit: boolean; theme: Theme; onUpdate: (t: Task) => void }) {
  const [newTitle, setNewTitle] = useState("");
  const subtasks = task.subtasks || [];
  const stDone = subtasks.filter((s) => s.checked).length;
  const stTotal = subtasks.length;
  const stPct = stTotal ? Math.round((stDone / stTotal) * 100) : 0;

  const addSubtask = () => {
    const title = newTitle.trim();
    if (!title || !canEdit) return;
    onUpdate({ ...task, subtasks: [...subtasks, { id: genId(), title, status: "todo", checked: false }] });
    setNewTitle("");
  };

  const toggle = (id: string) => {
    if (!canEdit) return;
    onUpdate({ ...task, subtasks: subtasks.map((s) => s.id === id ? { ...s, checked: !s.checked, status: !s.checked ? "done" : "todo" } : s) });
  };

  const updateTitle = (id: string, title: string) => {
    if (!canEdit) return;
    onUpdate({ ...task, subtasks: subtasks.map((s) => s.id === id ? { ...s, title } : s) });
  };

  const updateStatus = (id: string, status: string) => {
    if (!canEdit) return;
    onUpdate({ ...task, subtasks: subtasks.map((s) => s.id === id ? { ...s, status, checked: status === "done" } : s) });
  };

  const remove = (id: string) => {
    if (!canEdit) return;
    onUpdate({ ...task, subtasks: subtasks.filter((s) => s.id !== id) });
  };

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Subtarefas</span>
        {stTotal > 0 && (
          <>
            <span style={{ fontSize: 12, color: theme.textMuted }}>{stDone}/{stTotal}</span>
            <div style={{ flex: 1, height: 4, borderRadius: 4, background: theme.inputBg, maxWidth: 120 }}>
              <div style={{ width: stPct + "%", height: "100%", borderRadius: 4, background: "var(--status-done)", transition: "width 0.3s" }} />
            </div>
          </>
        )}
      </div>

      {subtasks.map((st) => (
        <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${theme.border}` }}>
          <button
            onClick={() => toggle(st.id)}
            aria-label={st.checked ? "Desmarcar subtarefa" : "Marcar como concluída"}
            disabled={!canEdit}
            style={{
              width: 18, height: 18, borderRadius: 4,
              border: `2px solid ${st.checked ? "var(--status-done)" : theme.textMuted}`,
              background: st.checked ? "var(--status-done)" : "transparent",
              cursor: canEdit ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, padding: 0,
            }}
          >
            {st.checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
          </button>
          <input
            value={st.title}
            onChange={(e) => updateTitle(st.id, e.target.value)}
            disabled={!canEdit}
            aria-label="Título da subtarefa"
            style={{
              flex: 1, fontSize: 14, color: st.checked ? theme.textMuted : theme.text,
              textDecoration: st.checked ? "line-through" : "none",
              background: "transparent", border: "none", outline: "none",
              fontFamily: "inherit", padding: 0,
            }}
          />
          <select
            value={st.status}
            onChange={(e) => updateStatus(st.id, e.target.value)}
            disabled={!canEdit}
            aria-label="Status da subtarefa"
            style={{
              background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
              borderRadius: 6, padding: "3px 8px", color: theme.text, fontSize: 11,
              outline: "none", cursor: canEdit ? "pointer" : "default",
              fontFamily: "inherit", colorScheme: theme.scheme,
            }}
          >
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {canEdit && (
            <button
              onClick={() => remove(st.id)}
              aria-label="Remover subtarefa"
              style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 16, padding: "0 4px", opacity: 0.4 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
            >
              ×
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px dashed ${theme.textMuted}`, opacity: 0.4, flexShrink: 0 }} />
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); }}
            placeholder="Adicionar subtarefa..."
            aria-label="Nova subtarefa"
            style={{ flex: 1, background: "transparent", border: "none", color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit", padding: 0 }}
          />
        </div>
      )}
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
          style={{ background: "transparent", border: "none", color: overdue ? "#E2445C" : theme.textSecondary, fontSize: 13, outline: "none", width: "100%", colorScheme: theme.scheme, cursor: canEdit ? "pointer" : "default", fontFamily: "inherit" }} />
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

      {!isSubtask && (
        <LinkCell task={task} theme={theme} canEdit={canEdit} onUpdate={onUpdate} />
      )}

      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button onClick={(e) => { e.stopPropagation(); onOpen(task); }}
          style={{ background: theme.inputBg, border: "none", color: theme.textSecondary, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }}>❯</button>
      </div>
    </div>
  );
}

// ——— Link Cell ———
function LinkCell({ task, theme, canEdit, onUpdate }: { task: Task; theme: Theme; canEdit: boolean; onUpdate: (t: Task) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.link || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(task.link || ""); }, [task.link]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => {
    const v = value.trim();
    if (v !== (task.link || "")) onUpdate({ ...task, link: v });
    setEditing(false);
  };

  const isValid = (() => {
    if (!task.link) return false;
    try { new URL(task.link); return true; } catch { return false; }
  })();

  if (editing) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setValue(task.link || ""); setEditing(false); }
          }}
          placeholder="https://…"
          aria-label="URL do link"
          style={{
            width: "100%", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
            borderRadius: 6, padding: "4px 8px", color: theme.text, fontSize: 12,
            outline: "none", fontFamily: "inherit",
          }}
        />
      </div>
    );
  }

  if (isValid) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
        <a
          href={task.link}
          target="_blank"
          rel="noopener noreferrer"
          title={task.link}
          aria-label={`Abrir ${task.link}`}
          style={{ color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, textDecoration: "none", padding: "2px 6px", borderRadius: 6, background: "var(--primary-soft)" }}
        >
          <Link2 size={14} aria-hidden /> abrir
        </a>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            aria-label="Editar link"
            title="Editar"
            style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", padding: "2px 4px", borderRadius: 4, fontSize: 11, opacity: 0.5 }}
          >
            ✎
          </button>
        )}
      </div>
    );
  }

  if (!canEdit) return <div />;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      aria-label="Adicionar link"
      style={{ background: "transparent", border: `1px dashed ${theme.border}`, color: theme.textMuted, cursor: "pointer", padding: "4px 8px", borderRadius: 6, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}
    >
      <Link2 size={12} aria-hidden /> link
    </button>
  );
}

// ——— Group Header ———
function GroupHeader({ group, collapsed, onToggle, taskCount, theme, dragHandleProps, canEdit, onQuickAdd }: {
  group: Group;
  collapsed: boolean;
  onToggle: () => void;
  taskCount: number;
  theme: Theme;
  dragHandleProps?: Record<string, unknown>;
  canEdit?: boolean;
  onQuickAdd?: () => void;
}) {
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

      {canEdit && onQuickAdd && (
        <button
          onClick={(e) => { e.stopPropagation(); onQuickAdd(); }}
          aria-label={`Nova tarefa em ${group.name}`}
          title="Nova tarefa neste grupo"
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 4,
            background: theme.inputBg, border: `1px solid ${theme.border}`, color: group.color,
            padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          + tarefa
        </button>
      )}
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
            outline: "none", fontFamily: "inherit"
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
        <StatCard label="Total" value={myTasks.length} color="var(--primary)" theme={theme} />
        <StatCard label="Concluídas" value={done} color="#00C875" theme={theme} />
        <StatCard label="Em progresso" value={doing} color="#FDAB3D" theme={theme} />
        <StatCard label="Atrasadas" value={overdue} color="#E2445C" theme={theme} />
      </div>
      {myTasks.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="Nenhuma tarefa atribuída a você"
          description="Quando alguém te marcar numa tarefa, ela aparece aqui."
        />
      )}
      {myGroups.map((group) => (
        <div key={group.id} style={{ marginBottom: 20, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden", background: theme.surface }}>
          <GroupHeader group={group} collapsed={myCollapsed.has(group.id)} onToggle={() => setMyCollapsed((prev) => { const n = new Set(prev); n.has(group.id) ? n.delete(group.id) : n.add(group.id); return n; })} taskCount={group.tasks.length} theme={theme} />
          {!myCollapsed.has(group.id) && (<>
            <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, padding: "10px 12px", gap: 8, borderBottom: `1px solid ${theme.borderStrong}`, fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 1.2, background: theme.surfaceHover, borderLeft: `4px solid ${group.color}` }}>
              <div></div><div>Tarefa</div><div>Status</div><div>Projeto</div><div>Prazo</div><div>Prioridade</div><div>Pessoa</div><div>Link</div><div></div>
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
          style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, cursor: "pointer", fontSize: 12, fontFamily: "inherit", ...b.s }}>
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
            style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "6px 14px", color: theme.text, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>← Voltar</button>
          <input value={selectedNote.title} onChange={(e) => { const u = { ...selectedNote, title: e.target.value }; setSelectedNote(u); scheduleAutosave(u); }}
            style={{ flex: 1, fontSize: 20, fontWeight: 700, background: "transparent", border: "none", color: theme.text, outline: "none", fontFamily: "inherit" }} />
          <button onMouseDown={(e) => { e.preventDefault(); togglePin(selectedNote); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: selectedNote.pinned ? 1 : 0.4 }}>📌</button>
          <button onClick={() => { deleteNote(selectedNote.id); setSelectedNote(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#E2445C" }}>🗑️</button>
        </div>
        <RichTextToolbar theme={theme} />
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onInput={() => { if (editorRef.current) { const u = { ...selectedNote, content: editorRef.current.innerHTML }; setSelectedNote(u); scheduleAutosave(u); } }}
          dangerouslySetInnerHTML={{ __html: selectedNote.content }}
          style={{ padding: "20px 24px", flex: 1, outline: "none", color: theme.text, fontSize: 14, lineHeight: 1.8, fontFamily: "inherit", overflowY: "auto", minHeight: 200 }}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <span aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, display: "flex" }}><Search size={16} /></span>
          <input value={searchNotes} onChange={(e) => setSearchNotes(e.target.value)} placeholder="Buscar anotações..."
            style={{ width: "100%", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px 8px 34px", color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
        </div>
        <button onClick={createNote}
          style={{ background: "var(--primary)", border: "none", color: "#fff", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px var(--primary-ring)", whiteSpace: "nowrap" }}>
          <Plus size={16} aria-hidden /> Nova Anotação
        </button>
      </div>
      {loading ? (
        <SkeletonList rows={5} />
      ) : filteredNotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={searchNotes ? "Nenhuma nota encontrada" : "Nenhuma anotação ainda"}
          description={searchNotes ? "Tente outro termo de busca." : "Clique em “Nova Anotação” acima para começar a escrever."}
        />
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

  if (loading) return (
    <div style={{ padding: 24, maxWidth: 500, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Skeleton width={120} height={12} style={{ margin: "0 auto 10px" }} />
        <Skeleton width={80} height={36} rounded={10} style={{ margin: "0 auto" }} />
      </div>
      <SkeletonList rows={4} />
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: theme.textMuted, textTransform: "capitalize" }}>{todayFormatted}</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: pct === 100 ? "#00C875" : "var(--primary)", marginTop: 4 }}>{pct}%</div>
        <div style={{ maxWidth: 300, margin: "8px auto 0", height: 6, borderRadius: 6, background: theme.inputBg }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: pct === 100 ? "#00C875" : "var(--primary)", transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>{completedToday} de {totalItems} concluídos</div>
      </div>

      <div style={{ maxWidth: 500, margin: "0 auto" }}>
        {items.length === 0 && (
          <EmptyState
            icon={Repeat}
            title="Nenhum item na rotina"
            description="Adicione hábitos no campo abaixo para acompanhar todo dia."
            size="sm"
          />
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
                  style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 6, padding: "4px 8px", color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
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
            style={{ flex: 1, background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: 8, padding: "10px 14px", color: theme.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <button onClick={addItem} style={{ background: "var(--primary)", border: "none", borderRadius: 8, color: "#fff", padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>+</button>
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
                  <div style={{ fontSize: 10, color: isToday ? "var(--primary)" : theme.textMuted, fontWeight: isToday ? 700 : 400, marginBottom: 4 }}>
                    {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}
                  </div>
                  <div style={{ height: 40, borderRadius: 6, background: theme.inputBg, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${dayPct}%`, background: dayPct === 100 ? "#00C875" : "var(--primary)", borderRadius: 6, transition: "height 0.3s" }} />
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
            style={{ padding: "12px 20px", border: "none", borderBottom: personalTab === t.key ? "2px solid var(--primary)" : "2px solid transparent", background: "transparent", color: personalTab === t.key ? "var(--primary)" : theme.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", marginBottom: -1 }}>
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
  const [mode, setMode] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ordum-theme");
      return saved === "light" ? "light" : "dark";
    }
    return "dark";
  });
  const theme = useMemo(() => getTheme(mode), [mode]);

  useEffect(() => {
    localStorage.setItem("ordum-theme", mode);
    document.documentElement.setAttribute("data-theme", mode);
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
  const [activeView, setActiveView] = useState<"dashboard" | "tasks" | "personal">("dashboard");
  const [personalTab, setPersonalTab] = useState<"minhas-tarefas" | "anotacoes" | "rotina">("minhas-tarefas");
  const [groupOrder, setGroupOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexia-group-order");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "error" | "success" }[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; description?: string; onConfirm: () => void | Promise<void> } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tasksViewMode, setTasksViewMode] = useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") return "list";
    const saved = localStorage.getItem("ordum-tasks-view");
    return saved === "kanban" ? "kanban" : "list";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("ordum-tasks-view", tasksViewMode);
  }, [tasksViewMode]);
  const searchRef = useRef<HTMLInputElement>(null);

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

  /** Cria "Nova tarefa" no projeto e abre o drawer pra editar imediatamente. */
  const addTaskInGroup = async (projectId: string) => {
    if (!canEdit || !currentUser) return;
    try {
      const nt = await api.createTask({ title: "Nova tarefa", status: "todo", priority: "medium", projectId, assignedTo: currentUser.id });
      setTasks((prev) => [nt, ...prev]);
      // Garante que o grupo correspondente fica expandido
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
      setDetailTask(nt);
    } catch { showToast("Erro ao criar tarefa"); }
  };

  const addProject = async () => {
    if (!newProjectName.trim() || !isAdmin || !currentUser) return;
    const colors = ["var(--primary)", "#00C875", "#FF6B6B", "#FDAB3D", "#579BFC", "#FF78CB", "#9B59B6", "#1ABC9C"];
    const icons = ["📌", "⚡", "💡", "🎯", "🔥", "🌟", "🚀", "🌐"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const icon = icons[Math.floor(Math.random() * icons.length)];
    try {
      const np = await api.createProject({ name: newProjectName.trim(), color, icon });
      setProjects((prev) => [...prev, { ...np, ownerId: np.ownerId || currentUser.id, sharedWith: np.sharedWith || [] }]);
    } catch { showToast("Erro ao criar projeto"); }
    setNewProjectName(""); setShowNewProject(false);
  };

  const deleteProject = (projId: string) => {
    if (!isAdmin) return;
    const proj = projects.find((p) => p.id === projId);
    const taskCount = tasks.filter((t) => t.projectId === projId).length;
    setConfirm({
      title: `Apagar projeto "${proj?.name}"?`,
      description: taskCount > 0
        ? `Esta ação também removerá ${taskCount} tarefa${taskCount > 1 ? "s" : ""} associada${taskCount > 1 ? "s" : ""}. Tudo fica recuperável via banco.`
        : "O projeto será arquivado.",
      onConfirm: async () => {
        try {
          await api.deleteProject(projId);
          setProjects((prev) => prev.filter((p) => p.id !== projId));
          setTasks((prev) => prev.filter((t) => t.projectId !== projId));
          if (activeProject === projId) setActiveProject("all");
          showToast(`Projeto "${proj?.name}" apagado`, "success");
        } catch { showToast("Erro ao apagar projeto"); }
        setConfirm(null);
      },
    });
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

  const shortcuts: Shortcut[] = useMemo(() => [
    { combo: "n", description: "Nova tarefa", handler: (e) => { e.preventDefault(); if (canEdit) addTask(); } },
    { combo: "/", description: "Focar busca", handler: (e) => { e.preventDefault(); searchRef.current?.focus(); } },
    { combo: "shift+/", description: "Mostrar atalhos", handler: (e) => { e.preventDefault(); setShortcutsOpen(true); } },
    { combo: "Escape", description: "Fechar modais", handler: () => { setShortcutsOpen(false); setSidebarOpen(false); setDetailTask(null); }, allowInInputs: true },
  ], [canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useKeyboardShortcuts(shortcuts, !!currentUser);

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} mode={mode} onToggleTheme={() => setMode(mode === "dark" ? "light" : "dark")} />;
  }

  return (
    <div className="app-shell" style={{ display: "flex", height: "100vh", fontFamily: "inherit", fontSize: 14, lineHeight: 1.43, background: theme.bg, color: theme.text }}>
      <style>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 10px; }
        .task-row:hover { background: var(--surface-hover) !important; }
        .sidebar-item { transition: all 0.15s; border: none; cursor: pointer; width: 100%; text-align: left; font-family: inherit; }
        .sidebar-item:hover { background: var(--surface-hover) !important; }
        .sidebar-item:hover .proj-menu-btn { opacity: 0.6 !important; }
        .sidebar-item:hover .proj-count { opacity: 0 !important; position: absolute !important; }
        .sidebar-item .proj-menu-btn:hover { opacity: 1 !important; color: var(--status-review) !important; }
        input::placeholder, textarea::placeholder { color: var(--text-muted); }

        /* ── Responsividade: sidebar vira drawer em <=1024px ─────── */
        .menu-toggle { display: none; }
        .sidebar-backdrop { display: none; }
        @media (max-width: 1024px) {
          .menu-toggle { display: inline-flex; }
          .app-sidebar {
            position: fixed !important;
            inset: 0 auto 0 0;
            z-index: 1100;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            box-shadow: 8px 0 32px rgba(0,0,0,0.18);
          }
          .app-sidebar[data-open="true"] { transform: translateX(0); }
          .sidebar-backdrop {
            display: block;
            position: fixed; inset: 0; z-index: 1099;
            background: var(--overlay); backdrop-filter: blur(4px);
            animation: fadeIn 0.2s ease-out;
          }
        }
        @media (max-width: 768px) {
          .app-header-search { width: 100% !important; }
          .app-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
        }
      `}</style>

      {/* Backdrop (mobile drawer) */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden />}

      {/* Sidebar */}
      <aside className="app-sidebar" data-open={sidebarOpen ? "true" : "false"}
        style={{ width: 260, background: "var(--sidebar)", color: "var(--sidebar-text)", borderRight: `1px solid var(--sidebar-border)`, display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0, height: "100%" }}>
        <div style={{ padding: "0 20px 20px", borderBottom: `1px solid var(--sidebar-border)` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <OrdumLogo height={28} mode={mode} forceWhite />
            <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              aria-label={mode === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid var(--sidebar-border)`, background: "var(--sidebar-input-bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sidebar-text)" }}>
              {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
          <button className="sidebar-item" onClick={() => { setActiveView("dashboard"); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 6, fontSize: 14, fontWeight: 600, background: activeView === "dashboard" ? "var(--sidebar-active-bg)" : "transparent", color: activeView === "dashboard" ? "var(--sidebar-active-text)" : "var(--sidebar-text-secondary)", width: "100%", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <LayoutDashboard size={16} aria-hidden /><span style={{ flex: 1 }}>Dashboard</span>
          </button>

          <button className="sidebar-item" onClick={() => { setActiveView("personal"); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 10, fontSize: 14, fontWeight: 600, background: activeView === "personal" ? "var(--sidebar-active-bg)" : "transparent", color: activeView === "personal" ? "var(--sidebar-active-text)" : "var(--sidebar-text-secondary)", width: "100%", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <UserIcon size={16} aria-hidden /><span style={{ flex: 1 }}>Minha Área</span>
          </button>

          <div style={{ fontSize: 12, color: "var(--sidebar-text-muted)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", padding: "0 8px", marginBottom: 8 }}>Projetos</div>

          <button className="sidebar-item" onClick={() => { setActiveView("tasks"); setActiveProject("all"); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: 500, background: activeProject === "all" ? "var(--sidebar-active-bg)" : "transparent", color: activeProject === "all" ? "var(--sidebar-active-text)" : "var(--sidebar-text-secondary)" }}>
            <LayoutGrid size={16} aria-hidden /><span style={{ flex: 1 }}>Todos</span>
            <span style={{ fontSize: 12, color: "var(--sidebar-text-muted)", background: "var(--sidebar-input-bg)", padding: "2px 8px", borderRadius: 10 }}>{counts.all}</span>
          </button>

          {visibleProjects.map((proj) => (
            <div key={proj.id} className="sidebar-item" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, fontSize: 14, fontWeight: 500, background: activeProject === proj.id ? "var(--sidebar-active-bg)" : "transparent", color: activeProject === proj.id ? "var(--sidebar-active-text)" : "var(--sidebar-text-secondary)", cursor: "pointer", position: "relative" }}
              onClick={() => { setActiveView("tasks"); setActiveProject(proj.id); }}>
              <span style={{ fontSize: 16 }}>{proj.icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</span>
              <span className="proj-count" style={{ fontSize: 12, color: "var(--sidebar-text-muted)", background: "var(--sidebar-input-bg)", padding: "2px 8px", borderRadius: 10, transition: "opacity 0.15s" }}>{counts[proj.id] || 0}</span>
              {isAdmin && (
                <button onClick={(e) => { e.stopPropagation(); deleteProject(proj.id); }}
                  className="proj-menu-btn"
                  style={{ background: "none", border: "none", color: "var(--sidebar-text-muted)", cursor: "pointer", fontSize: 16, padding: "0 4px", borderRadius: 4, opacity: 0, transition: "opacity 0.15s", letterSpacing: 1, lineHeight: 1, fontWeight: 700 }}
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
                  style={{ flex: 1, background: "var(--sidebar-input-bg)", border: `1px solid var(--sidebar-border)`, borderRadius: 6, padding: "6px 10px", color: "var(--sidebar-text)", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
                <button onClick={addProject} style={{ background: "var(--sidebar-active-bg)", border: "none", color: "var(--sidebar-text)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                <button onClick={() => setShowNewProject(false)} style={{ background: "var(--sidebar-input-bg)", border: "none", color: "var(--sidebar-text-secondary)", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowNewProject(true)} className="sidebar-item"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, marginTop: 6, fontSize: 12, color: "var(--sidebar-text-muted)", background: "transparent" }}>
                <span style={{ fontSize: 14 }}>+</span> Novo projeto
              </button>
            )
          )}
        </div>

        <div style={{ padding: "12px", borderTop: `1px solid var(--sidebar-border)`, display: "flex", flexDirection: "column", gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setShowAdmin(true)} className="sidebar-item"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#FFB4BD", background: "transparent" }}>
              <Settings size={16} aria-hidden /> Painel Admin
            </button>
          )}

          <div style={{ padding: "6px 12px", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--sidebar-text-muted)" }}>
            <span>Total: <b style={{ color: "var(--sidebar-text)" }}>{filteredTasks.length}</b></span>
            <span style={{ color: "#7CFFB4" }}>✓ {tasks.filter((t) => t.status === "done").length}</span>
            <span style={{ color: "#E2445C" }}>⚠ {tasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length}</span>
          </div>

          {/* Bloco do usuário — agora no footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", borderRadius: 10, background: "var(--sidebar-input-bg)" }}>
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="Abrir meu perfil"
              title="Editar perfil"
              style={{
                flex: 1, display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none", cursor: "pointer",
                padding: "4px 4px", borderRadius: 8,
                fontFamily: "inherit", textAlign: "left", minWidth: 0,
              }}
            >
              <UserAvatar avatar={currentUser.avatar} name={currentUser.name} size={32} background="rgba(255,255,255,0.18)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sidebar-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.name}</div>
                <div style={{ fontSize: 12, color: "var(--sidebar-text-secondary)", fontWeight: 600 }}>{ROLES[currentUser.role].icon} {ROLES[currentUser.role].label}</div>
              </div>
            </button>
            <button onClick={handleLogout} aria-label="Sair"
              style={{ background: "none", border: "none", color: "var(--sidebar-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 6 }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="app-main" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--surface)" }}>
        <AnimatePresence mode="wait" initial={false}>
        {activeView === "dashboard" ? (
          <motion.div
            key="view-dashboard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
          >
          <DashboardView
            currentUser={currentUser}
            projects={visibleProjects}
            users={users}
            canEdit={canEdit}
            isAdmin={isAdmin}
            defaultProjectId={visibleProjects[0]?.id ?? null}
            onOpenTask={(t) => setDetailTask(t)}
            onOpenProject={(projId) => { setActiveView("tasks"); setActiveProject(projId); }}
            onSeeAllProjects={() => { setActiveView("tasks"); setActiveProject("all"); }}
            onNewProject={isAdmin ? () => { setActiveView("tasks"); setShowNewProject(true); } : undefined}
          />
          </motion.div>
        ) : activeView === "tasks" ? (
          <motion.div
            key="view-tasks"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
          >
        <div className="app-header" style={{ padding: "16px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
            style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text, cursor: "pointer" }}
          >
            <MenuIcon size={18} aria-hidden />
          </button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              {activeProj
                ? <><span aria-hidden>{activeProj.icon}</span>{activeProj.name}</>
                : <><LayoutGrid size={22} aria-hidden /> Todas as Tarefas</>}
            </h1>
            <p style={{ fontSize: 14, color: theme.textMuted, marginTop: 2 }}>{filteredTasks.length} tarefa{filteredTasks.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ position: "relative" }}>
            <span aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, display: "flex" }}><Search size={16} /></span>
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefas..."
              aria-label="Buscar tarefas"
              style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px 8px 34px", color: theme.text, fontSize: 14, outline: "none", width: 200, fontFamily: "inherit" }} />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px", color: theme.text, fontSize: 14, outline: "none", cursor: "pointer", colorScheme: theme.scheme, fontFamily: "inherit" }}>
            <option value="all">Todos Status</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Toggle Lista/Kanban */}
          <div role="tablist" aria-label="Modo de visualização" style={{ display: "inline-flex", background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 3 }}>
            <button
              role="tab"
              aria-selected={tasksViewMode === "list"}
              aria-label="Visualização em lista"
              onClick={() => setTasksViewMode("list")}
              title="Lista"
              style={{
                width: 34, height: 30, borderRadius: 7, border: "none",
                background: tasksViewMode === "list" ? "var(--primary)" : "transparent",
                color: tasksViewMode === "list" ? "#fff" : theme.textSecondary,
                cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <List size={15} aria-hidden />
            </button>
            <button
              role="tab"
              aria-selected={tasksViewMode === "kanban"}
              aria-label="Visualização Kanban"
              onClick={() => setTasksViewMode("kanban")}
              title="Kanban"
              style={{
                width: 34, height: 30, borderRadius: 7, border: "none",
                background: tasksViewMode === "kanban" ? "var(--primary)" : "transparent",
                color: tasksViewMode === "kanban" ? "#fff" : theme.textSecondary,
                cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <KanbanSquare size={15} aria-hidden />
            </button>
          </div>

          {canEdit && (
            <button onClick={addTask}
              style={{ background: "var(--primary)", border: "none", color: "#fff", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 16px var(--primary-ring)" }}>
              <Plus size={16} aria-hidden /> Nova Tarefa
            </button>
          )}
        </div>

        {tasksViewMode === "kanban" ? (
          <KanbanBoard
            tasks={filteredTasks}
            projects={visibleProjects}
            users={users}
            canEdit={canEdit}
            defaultProjectId={activeProject !== "all" ? activeProject : (visibleProjects[0]?.id ?? null)}
            onUpdate={updateTask}
            onOpen={(t) => setDetailTask(t)}
            onQuickAdd={(projectId, status) => {
              if (!currentUser) return;
              api.createTask({ title: "Nova tarefa", status, priority: "medium", projectId, assignedTo: currentUser.id })
                .then((nt) => { setTasks((prev) => [nt, ...prev]); setDetailTask(nt); })
                .catch(() => showToast("Erro ao criar tarefa"));
            }}
          />
        ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
          {filteredTasks.length === 0 && (
            <EmptyState
              icon={ListChecks}
              title="Nenhuma tarefa encontrada"
              description={canEdit
                ? "Clique em “Nova Tarefa” ou pressione N para começar."
                : "Peça ao admin para compartilhar projetos com você."}
            />
          )}
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {groups.map((group) => (
                <SortableGroup key={group.id} id={group.id}>
                  {(dragHandleProps) => (
                    <div style={{ marginBottom: 20, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: "hidden", background: theme.surface }}>
                      <GroupHeader group={group} collapsed={collapsedGroups.has(group.id)} onToggle={() => toggleCollapseGroup(group.id)} taskCount={group.tasks.length} theme={theme} dragHandleProps={dragHandleProps} canEdit={canEdit} onQuickAdd={() => addTaskInGroup(group.id)} />
                      {!collapsedGroups.has(group.id) && (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, padding: "10px 12px", gap: 8, borderBottom: `1px solid ${theme.borderStrong}`, fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.8, background: theme.surfaceHover, borderLeft: `4px solid ${group.color}` }}>
                            <div></div><div>Tarefa</div><div>Status</div><div>Projeto</div><div>Prazo</div><div>Prioridade</div><div>Pessoa</div><div>Link</div><div></div>
                          </div>
                          {/* Quick add no TOPO do grupo (estilo monday): clica e digita */}
                          {canEdit && <div style={{ borderLeft: `4px solid ${group.color}` }}><InlineAddRow groupProjectId={group.id} theme={theme} onAdd={addTaskInline} /></div>}
                          {group.tasks.map((task) => (
                            <div key={task.id} style={{ borderLeft: `4px solid ${group.color}` }}>
                              <TaskRow task={task} projects={visibleProjects} users={users} onUpdate={updateTask} onOpen={setDetailTask} theme={theme} canEdit={canEdit} isExpanded={expandedTasks.has(task.id)} onToggleExpand={toggleExpandTask} />
                              {expandedTasks.has(task.id) && (task.subtasks || []).map((st) => {
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
                        </>
                      )}
                    </div>
                  )}
                </SortableGroup>
              ))}
            </SortableContext>
          </DndContext>
        </div>
        )}
          </motion.div>
        ) : (
          <motion.div
            key="view-personal"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
          >
            <PersonalArea theme={theme} currentUser={currentUser} tasks={tasks} projects={visibleProjects} users={users} personalTab={personalTab} onTabChange={setPersonalTab} canEdit={canEdit} onOpenTask={setDetailTask} onUpdateTask={updateTask} />
          </motion.div>
        )}
        </AnimatePresence>
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
      <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: t.type === "error" ? "rgba(226,68,92,0.95)" : "rgba(0,200,117,0.95)",
            color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            animation: "fadeUp 0.25s ease-out",
          }}>
            <span aria-hidden style={{ marginRight: 6 }}>{t.type === "error" ? "⚠" : "✓"}</span>
            {t.message}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel="Apagar"
        destructive
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />

      <ShortcutsHelp open={shortcutsOpen} shortcuts={shortcuts} onClose={() => setShortcutsOpen(false)} />

      <ProfilePanel
        open={profileOpen}
        user={currentUser}
        onClose={() => setProfileOpen(false)}
        onUserUpdated={(u) => {
          setCurrentUser(u);
          // Mantém a lista de users em sync também
          setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, name: u.name, avatar: u.avatar } : x)));
        }}
      />
    </div>
  );
}
