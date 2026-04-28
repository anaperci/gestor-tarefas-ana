"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ContentComment, User } from "@/lib/types";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Props {
  contentItemId: string;
  comments: ContentComment[];
  currentUser: User;
  users: User[];
  onChange: () => void | Promise<unknown>;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function CommentsThread({ contentItemId, comments, currentUser, users, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const send = async () => {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.createContentComment(contentItemId, draft.trim());
      setDraft("");
      await onChange();
    } finally { setSubmitting(false); }
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.trim()) return;
    await api.updateContentComment(id, editDraft.trim());
    setEditingId(null);
    onChange();
  };

  const remove = async (id: string) => {
    await api.deleteContentComment(id);
    setConfirmDelete(null);
    onChange();
  };

  return (
    <section aria-label="Comentários" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>
        Conversa <span style={{ marginLeft: 6, color: "var(--text-secondary)" }}>{comments.length}</span>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
        <AnimatePresence initial={false}>
          {comments.map((c) => {
            const author = users.find((u) => u.id === c.userId);
            const isMine = c.userId === currentUser.id;
            const isEditing = editingId === c.id;
            return (
              <motion.article
                key={c.id}
                layout
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {author && <UserAvatar avatar={author.avatar} name={author.name} size={22} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{author?.name ?? "?"}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {relTime(c.createdAt)}</span>
                  {isMine && !isEditing && (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                      <button onClick={() => { setEditingId(c.id); setEditDraft(c.body); }}
                        aria-label="Editar" title="Editar"
                        style={iconBtn}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setConfirmDelete(c.id)}
                        aria-label="Excluir" title="Excluir"
                        style={{ ...iconBtn, color: "#E2445C" }}>
                        <Trash2 size={12} />
                      </button>
                    </span>
                  )}
                </header>
                {isEditing ? (
                  <div>
                    <textarea
                      autoFocus value={editDraft} onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      style={textareaStyle}
                    />
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                      <button onClick={() => setEditingId(null)} style={smallBtn}>Cancelar</button>
                      <button onClick={() => saveEdit(c.id)} style={{ ...smallBtn, background: "var(--primary)", color: "#fff", border: "none" }}>Salvar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {c.body}
                  </div>
                )}
              </motion.article>
            );
          })}
        </AnimatePresence>

        {comments.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
            Sem comentários ainda.
          </div>
        )}
      </div>

      <div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
          placeholder="Comente algo... (Cmd/Ctrl+Enter envia)"
          rows={2}
          style={textareaStyle}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
          <button
            onClick={send}
            disabled={!draft.trim() || submitting}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "none",
              background: "var(--primary)", color: "#fff",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              opacity: !draft.trim() || submitting ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            {submitting ? "Enviando…" : "Comentar"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir comentário?"
        confirmLabel="Excluir"
        destructive
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}

const iconBtn: React.CSSProperties = {
  background: "transparent", border: "none", cursor: "pointer",
  color: "var(--text-secondary)", padding: 4, borderRadius: 4, display: "flex",
};

const smallBtn: React.CSSProperties = {
  padding: "5px 10px", borderRadius: 6,
  border: "1px solid var(--border-strong)", background: "transparent",
  color: "var(--text)", fontSize: 11, fontWeight: 600, cursor: "pointer",
  fontFamily: "inherit",
};

const textareaStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "var(--input-bg)", border: "1px solid var(--input-border)",
  color: "var(--text)", fontSize: 13, lineHeight: 1.5,
  outline: "none", fontFamily: "inherit", resize: "vertical",
  borderRadius: 8,
};
