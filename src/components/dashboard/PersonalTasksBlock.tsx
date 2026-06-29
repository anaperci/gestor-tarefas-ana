"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ListTodo, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PersonalTask } from "@/lib/types";
import { BlockCard } from "./BlockCard";

interface PersonalTasksBlockProps {
  delay?: number;
}

export function PersonalTasksBlock({ delay }: PersonalTasksBlockProps) {
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getPersonalTasks().then((t) => { setTasks(t); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const add = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const created = await api.addPersonalTask({ title });
      setTasks((prev) => [created, ...prev]);
      setDraft("");
    } catch { /* silencioso — input mantém o texto */ }
    finally { setAdding(false); }
  };

  const toggle = async (t: PersonalTask) => {
    const checked = !t.checked;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, checked } : x)));
    try { await api.setPersonalTaskChecked(t.id, checked); }
    catch { setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, checked: !checked } : x))); }
  };

  const remove = async (t: PersonalTask) => {
    const prev = tasks;
    setTasks((p) => p.filter((x) => x.id !== t.id));
    try { await api.deletePersonalTask(t.id); }
    catch { setTasks(prev); }
  };

  const pending = tasks.filter((t) => !t.checked).length;
  // Pendentes primeiro, concluídas embaixo.
  const ordered = [...tasks].sort((a, b) => Number(a.checked) - Number(b.checked));

  return (
    <BlockCard icon={ListTodo} iconColor="var(--accent)" title="Pessoal" count={loaded ? pending : undefined} borderLeft="var(--accent)" delay={delay}>
      <div style={{ display: "flex", gap: 8, marginBottom: tasks.length ? 12 : 0 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Anota uma pendência sua e Enter…"
          aria-label="Nova pendência pessoal"
          style={{
            flex: 1, minWidth: 0,
            padding: "10px 12px", borderRadius: 10,
            border: "1px solid var(--border-strong)", background: "var(--surface-2)",
            color: "var(--text)", fontSize: 14, fontFamily: "inherit", outline: "none",
          }}
        />
        <button
          onClick={add}
          disabled={!draft.trim() || adding}
          aria-label="Adicionar pendência"
          style={{
            flexShrink: 0, width: 40, borderRadius: 10, border: "none",
            background: draft.trim() ? "var(--accent)" : "var(--surface-hover)",
            color: draft.trim() ? "#fff" : "var(--text-muted)",
            cursor: draft.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Plus size={18} aria-hidden />
        </button>
      </div>

      {loaded && tasks.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 0 2px" }}>
          Sua lista pessoal está vazia. Só você vê o que está aqui.
        </div>
      )}

      {ordered.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {ordered.map((t) => (
            <li key={t.id}>
              <div
                className="personal-row"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 8px", borderRadius: 10, transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <motion.button
                  onClick={() => toggle(t)}
                  aria-label={t.checked ? `Desfazer ${t.title}` : `Concluir ${t.title}`}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                    border: `2px solid ${t.checked ? "var(--status-done)" : "var(--border-strong)"}`,
                    background: t.checked ? "var(--status-done)" : "transparent",
                    cursor: "pointer", padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {t.checked && <Check size={14} color="#fff" strokeWidth={3} aria-hidden />}
                </motion.button>
                <span style={{
                  flex: 1, fontSize: 14, color: "var(--text)",
                  textDecoration: t.checked ? "line-through" : "none",
                  opacity: t.checked ? 0.55 : 1, wordBreak: "break-word",
                }}>
                  {t.title}
                </span>
                <button
                  onClick={() => remove(t)}
                  aria-label={`Excluir ${t.title}`}
                  className="personal-del"
                  style={{
                    flexShrink: 0, border: "none", background: "transparent",
                    color: "var(--text-muted)", cursor: "pointer", padding: 4,
                    display: "flex", alignItems: "center", borderRadius: 6,
                  }}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .personal-del { opacity: 0; transition: opacity 0.15s, color 0.15s; }
        .personal-row:hover .personal-del { opacity: 1; }
        .personal-del:hover { color: var(--status-review); }
      `}</style>
    </BlockCard>
  );
}
