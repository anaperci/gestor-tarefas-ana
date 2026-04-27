"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StickyNote, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface NotesColumnProps {
  notes: Note[];
  onMutate: () => Promise<unknown> | void;
}

function relTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function NotesColumn({ notes: initialNotes, onMutate }: NotesColumnProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);

  useEffect(() => { setNotes(initialNotes); }, [initialNotes]);

  const handleCreate = async (content: string) => {
    if (!content.trim()) return;
    const created = await api.createNote({ title: content.slice(0, 60), content });
    setNotes((prev) => [created, ...prev].slice(0, 5));
    onMutate();
  };

  const handleSave = async (id: string, content: string) => {
    const updated = await api.updateNote(id, { content, title: content.slice(0, 60) });
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    onMutate();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await api.deleteNote(confirmDelete.id);
    setNotes((prev) => prev.filter((n) => n.id !== confirmDelete.id));
    setConfirmDelete(null);
    onMutate();
  };

  return (
    <aside
      aria-label="Notas rápidas"
      style={{
        width: 300,
        background: "var(--primary-soft)",
        borderLeft: "1px solid var(--border)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StickyNote size={18} color="var(--primary)" aria-hidden />
        <h2 style={{
          margin: 0, fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontSize: 16, fontWeight: 600, color: "var(--text)",
        }}>
          Notas
        </h2>
      </header>

      <QuickCapture onCreate={handleCreate} />

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        <AnimatePresence initial={false}>
          {notes.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}
            >
              <StickyNote size={42} color="var(--primary)" style={{ opacity: 0.3, margin: "0 auto" }} aria-hidden />
              <div style={{ fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
                Suas anotações rápidas aparecem aqui.
              </div>
            </motion.div>
          )}
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              expanded={editingId === n.id}
              onExpand={() => setEditingId(n.id)}
              onCollapse={() => setEditingId(null)}
              onSave={(c) => handleSave(n.id, c)}
              onDelete={() => setConfirmDelete(n)}
            />
          ))}
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir nota?"
        description={confirmDelete ? `"${(confirmDelete.title || confirmDelete.content || "Sem título").slice(0, 60)}"` : ""}
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </aside>
  );
}

// ─── Quick Capture ─────────────────────────────────────────────────────

function QuickCapture({ onCreate }: { onCreate: (content: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    if (!value.trim() || saving) return;
    setSaving(true);
    await onCreate(value.trim());
    setValue("");
    setSaving(false);
    setFocused(false);
    ref.current?.blur();
  };

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { if (!value.trim()) setFocused(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
        }}
        placeholder="Anote algo rápido..."
        aria-label="Captura rápida de nota"
        rows={focused || value ? 3 : 1}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          fontSize: 13, lineHeight: 1.5,
          outline: "none", fontFamily: "inherit",
          resize: "none",
          transition: "height 0.18s",
        }}
      />
      <AnimatePresence>
        {(focused || value) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {saving ? "salvando…" : "Enter pra salvar · Shift+Enter quebra linha"}
            </span>
            <button
              onClick={submit}
              disabled={!value.trim() || saving}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: "var(--primary)", color: "#fff",
                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                opacity: !value.trim() || saving ? 0.5 : 1,
              }}
            >
              Salvar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Note Card ─────────────────────────────────────────────────────────

function NoteCard({
  note, expanded, onExpand, onCollapse, onSave, onDelete,
}: {
  note: Note;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onSave: (content: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(note.content);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(note.content); }, [note.content]);

  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(ref.current.value.length, ref.current.value.length);
      });
    }
  }, [expanded]);

  const scheduleSave = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    setSavingState("saving");
    timer.current = setTimeout(async () => {
      if (next !== note.content) {
        await onSave(next);
        setSavingState("saved");
        setTimeout(() => setSavingState("idle"), 1200);
      } else {
        setSavingState("idle");
      }
    }, 800);
  };

  const handleBlur = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (draft !== note.content) {
      setSavingState("saving");
      await onSave(draft);
      setSavingState("idle");
    }
    onCollapse();
  };

  const preview = (note.content || "").replace(/<[^>]*>/g, "").trim();
  const title = note.title || preview.slice(0, 40) || "Sem título";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => { if (!expanded) onExpand(); }}
      style={{
        position: "relative",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        cursor: expanded ? "default" : "pointer",
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Excluir nota"
        title="Excluir"
        style={{
          position: "absolute", top: 6, right: 6,
          width: 24, height: 24, borderRadius: 6,
          background: "transparent", border: "none",
          color: "var(--text-muted)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: 0,
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
      >
        <Trash2 size={13} />
      </button>

      {expanded ? (
        <div onClick={(e) => e.stopPropagation()}>
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => scheduleSave(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === "Escape") handleBlur(); }}
            rows={Math.max(3, Math.min(10, draft.split("\n").length + 1))}
            style={{
              width: "100%", padding: 0,
              background: "transparent", border: "none",
              color: "var(--text)", fontSize: 13, lineHeight: 1.5,
              outline: "none", fontFamily: "inherit", resize: "none",
            }}
          />
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)", textAlign: "right", minHeight: 14 }}>
            {savingState === "saving" && "salvando…"}
            {savingState === "saved" && "salvo"}
          </div>
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 14, fontWeight: 600, color: "var(--text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {title}
          </div>
          {preview && preview !== title && (
            <div style={{
              marginTop: 4, fontSize: 13, color: "var(--text-secondary)",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", lineHeight: 1.4,
            }}>
              {preview}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
            {relTime(note.updatedAt)}
          </div>
        </>
      )}
    </motion.article>
  );
}
