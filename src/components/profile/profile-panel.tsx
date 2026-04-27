"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, KeyRound, Pencil, X } from "lucide-react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarPicker } from "@/components/ui/avatar-picker";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Visualizador",
};

interface ProfilePanelProps {
  open: boolean;
  user: User;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export function ProfilePanel({ open, user, onClose, onUserUpdated }: ProfilePanelProps) {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [name, setName] = useState(user.name);
  const [editingName, setEditingName] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { if (open) { setName(user.name); setEditingName(false); setShowPasswordForm(false); setNameError(null); } }, [open, user.name]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const showFlash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError("Nome não pode ficar vazio"); return; }
    if (trimmed === user.name) { setEditingName(false); return; }
    setSavingName(true);
    setNameError(null);
    try {
      await api.updateProfile(user.id, { name: trimmed });
      onUserUpdated({ ...user, name: trimmed });
      setEditingName(false);
      showFlash("Nome atualizado");
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSavingName(false);
    }
  };

  const saveAvatar = async (seed: string) => {
    try {
      await api.updateAvatar(user.id, seed);
      onUserUpdated({ ...user, avatar: seed });
      setShowAvatarPicker(false);
      showFlash("Avatar atualizado");
    } catch (e) {
      // Falha silenciosa — picker continua aberto pra retry
      console.error(e);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "var(--overlay)", backdropFilter: "blur(6px)", zIndex: 1500 }}
        aria-hidden
      />
      <motion.section
        key="panel"
        role="dialog"
        aria-modal="true"
        aria-label="Meu perfil"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: "min(440px, 96vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--card-border)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.18)",
          zIndex: 1501,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--card-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Meu perfil</h2>
          <button onClick={onClose} aria-label="Fechar"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 4, borderRadius: 6, display: "flex" }}>
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Avatar */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setShowAvatarPicker(true)}
              aria-label="Trocar avatar"
              title="Trocar avatar"
              style={{
                position: "relative",
                background: "transparent", border: "none", padding: 0, cursor: "pointer",
                borderRadius: "50%",
              }}
            >
              <UserAvatar avatar={user.avatar} name={user.name} size={96} />
              <span aria-hidden style={{
                position: "absolute", bottom: 0, right: 0,
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--primary)", color: "#fff",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: "2px solid var(--surface)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}>
                <Pencil size={13} />
              </span>
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Clique no avatar pra trocar</span>
          </div>

          {/* Nome */}
          <Field label="Nome">
            {editingName ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(user.name); setEditingName(false); } }}
                  aria-invalid={!!nameError}
                  style={inputStyle}
                />
                <button onClick={saveName} disabled={savingName}
                  aria-label="Salvar nome"
                  style={iconBtn("var(--status-done)")}>
                  <Check size={16} />
                </button>
                <button onClick={() => { setName(user.name); setEditingName(false); setNameError(null); }}
                  aria-label="Cancelar"
                  style={iconBtn("var(--text-muted)")}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 15, color: "var(--text)" }}>{user.name}</span>
                <button onClick={() => setEditingName(true)}
                  aria-label="Editar nome"
                  style={subtleBtn}>
                  <Pencil size={13} aria-hidden /> Editar
                </button>
              </div>
            )}
            {nameError && (
              <div role="alert" style={{ marginTop: 6, fontSize: 12, color: "var(--status-review)", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertCircle size={13} aria-hidden /> {nameError}
              </div>
            )}
          </Field>

          {/* Username */}
          <Field label="Username" hint="Não pode ser alterado">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{
                padding: "6px 10px", borderRadius: 6,
                background: "var(--surface-2)", fontSize: 13, color: "var(--text-secondary)",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}>@{user.username}</code>
            </div>
          </Field>

          {/* Role */}
          <Field label="Papel" hint="Definido pelo admin">
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 999,
              background: "var(--primary-soft)", color: "var(--primary)",
              fontSize: 13, fontWeight: 600,
            }}>
              {ROLE_LABEL[user.role]}
            </span>
          </Field>

          {/* Senha */}
          <div>
            <button
              onClick={() => setShowPasswordForm((v) => !v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "9px 14px", borderRadius: 10,
                background: showPasswordForm ? "var(--primary-soft)" : "var(--surface-2)",
                border: "1px solid var(--card-border)",
                color: showPasswordForm ? "var(--primary)" : "var(--text)",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <KeyRound size={14} aria-hidden /> {showPasswordForm ? "Cancelar troca de senha" : "Trocar senha"}
            </button>

            <AnimatePresence>
              {showPasswordForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: "hidden", marginTop: 14 }}
                >
                  <PasswordChangeForm
                    userId={user.id}
                    onSuccess={() => { setShowPasswordForm(false); showFlash("Senha atualizada"); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              role="status" aria-live="polite"
              style={{
                position: "absolute", bottom: 16, left: 16, right: 16,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--status-done)", color: "#fff",
                fontSize: 13, fontWeight: 600, textAlign: "center",
                boxShadow: "0 8px 24px rgba(0,200,117,0.3)",
              }}
            >
              ✓ {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <AvatarPicker
        open={showAvatarPicker}
        currentAvatar={user.avatar}
        userName={user.name}
        onCancel={() => setShowAvatarPicker(false)}
        onSelect={saveAvatar}
      />
    </AnimatePresence>
  );
}

// ─── Subform: senha ────────────────────────────────────────────────────

function PasswordChangeForm({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!current || !pwd || !confirm) { setError("Preencha todos os campos"); return; }
    if (pwd !== confirm) { setError("As senhas novas não conferem"); return; }
    if (pwd.length < 8) { setError("A nova senha precisa ter ao menos 8 caracteres"); return; }
    setSubmitting(true);
    try {
      await api.changeOwnPassword(userId, current, pwd);
      setCurrent(""); setPwd(""); setConfirm("");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao trocar senha");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Field label="Senha atual">
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password" style={inputStyle} />
      </Field>
      <Field label="Nova senha" hint="≥ 8 caracteres, 1 maiúscula, 1 minúscula, 1 número">
        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
          autoComplete="new-password" style={inputStyle} />
      </Field>
      <Field label="Confirmar nova senha">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          autoComplete="new-password" style={inputStyle} />
      </Field>

      {error && (
        <div role="alert" style={{ fontSize: 12, color: "var(--status-review)", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertCircle size={13} aria-hidden /> {error}
        </div>
      )}

      <button onClick={submit} disabled={submitting}
        style={{
          marginTop: 4, padding: "10px 16px", borderRadius: 10, border: "none",
          background: "var(--primary)", color: "#fff",
          fontSize: 13, fontWeight: 700, cursor: submitting ? "wait" : "pointer", fontFamily: "inherit",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Atualizando…" : "Atualizar senha"}
      </button>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-muted)", marginBottom: 6 }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  borderRadius: 10,
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  color: "var(--text)",
  fontSize: 14, outline: "none", fontFamily: "inherit",
};

const subtleBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "5px 10px", borderRadius: 8,
  background: "transparent", border: "1px solid var(--card-border)",
  color: "var(--text-secondary)",
  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};

const iconBtn = (color: string): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 8,
  background: color, color: "#fff",
  border: "none", cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
});
