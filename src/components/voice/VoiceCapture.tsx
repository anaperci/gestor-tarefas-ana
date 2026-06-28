"use client";

import { useRef, useState } from "react";
import { Mic, Square, Upload, X, Loader2, Trash2, Check, FileText, ListChecks } from "lucide-react";
import { api } from "@/lib/api";
import type { Project, User } from "@/lib/types";

type Stage = "idle" | "recording" | "processing" | "review";

interface VTask { title: string; projectId: string; dueDate: string; priority: "low" | "medium" | "high" }
interface VNote { title: string; body: string }

export function VoiceCapture({ projects, currentUser, onCreated, onToast }: {
  projects: Project[];
  currentUser: User;
  onCreated: () => void;
  onToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [tasks, setTasks] = useState<VTask[]>([]);
  const [notes, setNotes] = useState<VNote[]>([]);
  const [transcription, setTranscription] = useState("");
  const [saving, setSaving] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStage("idle"); setSeconds(0); setTasks([]); setNotes([]); setTranscription("");
    if (timerRef.current) clearInterval(timerRef.current);
  };
  const close = () => { reset(); setOpen(false); };

  const process = async (file: File) => {
    setStage("processing");
    try {
      const r = await api.processVoiceNote(file);
      if (!r.transcription) { onToast("Não consegui entender o áudio", "error"); reset(); return; }
      setTranscription(r.transcription);
      setTasks(r.tasks.map((t) => ({
        title: t.title,
        projectId: t.projectId || projects[0]?.id || "",
        dueDate: t.dueDate || "",
        priority: (t.priority || "medium") as VTask["priority"],
      })));
      setNotes(r.notes.map((n) => ({ title: n.title, body: n.body })));
      setStage("review");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Falha ao processar", "error");
      reset();
    }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        process(new File([blob], "nota.webm", { type: "audio/webm" }));
      };
      mediaRef.current = mr;
      mr.start();
      setStage("recording"); setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      onToast("Não foi possível acessar o microfone", "error");
    }
  };
  const stopRec = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) process(f);
  };

  const createAll = async () => {
    setSaving(true);
    let created = 0;
    try {
      for (const t of tasks) {
        if (!t.title.trim() || !t.projectId) continue;
        await api.createTask({
          title: t.title.trim(),
          projectId: t.projectId,
          status: "todo",
          priority: t.priority,
          assignedTo: currentUser.id,
          deadline: t.dueDate || undefined,
        });
        created++;
      }
      for (const n of notes) {
        if (!n.title.trim() && !n.body.trim()) continue;
        await api.createNote({ title: n.title.trim() || "Nota de voz", content: n.body });
        created++;
      }
      onToast(`${created} ${created === 1 ? "item criado" : "itens criados"}`, "success");
      onCreated();
      close();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Falha ao criar", "error");
    } finally { setSaving(false); }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const inp: React.CSSProperties = { padding: "8px 10px", background: "var(--input-bg)", border: "1px solid var(--input-border)", borderRadius: 8, color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "inherit" };

  return (
    <>
      {/* FAB */}
      <button onClick={() => setOpen(true)} aria-label="Capturar por voz" title="Capturar por voz"
        style={{ position: "fixed", bottom: 24, right: 24, zIndex: 900, width: 56, height: 56, borderRadius: "50%", border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px var(--primary-ring), 0 2px 8px rgba(15,76,92,0.3)" }}>
        <Mic size={24} />
      </button>

      {open && (
        <div role="dialog" aria-modal="true" onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "var(--overlay)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", border: "1px solid var(--card-border)", borderRadius: 16, width: "min(680px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(15,76,92,0.25)" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--card-border)" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                <Mic size={18} /> Capturar por voz
              </h2>
              <button onClick={close} aria-label="Fechar" style={{ background: "var(--input-bg)", border: "none", color: "var(--text-secondary)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
            </div>

            <div style={{ padding: 20, overflowY: "auto" }}>
              {stage === "idle" && (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
                    Grave um áudio ou suba um arquivo. A IA transforma em <b>tarefas</b> e <b>notas</b> pra você revisar.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={startRec}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 22px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      <Mic size={18} /> Gravar
                    </button>
                    <button onClick={() => fileRef.current?.click()}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--input-bg)", color: "var(--text)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "14px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      <Upload size={18} /> Subir áudio
                    </button>
                    <input ref={fileRef} type="file" accept="audio/*" onChange={onUpload} style={{ display: "none" }} />
                  </div>
                </div>
              )}

              {stage === "recording" && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: 40, fontWeight: 800, color: "var(--primary)", fontVariantNumeric: "tabular-nums", marginBottom: 8 }}>{mmss}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#E2445C", fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E2445C", animation: "pulse 1s infinite" }} /> Gravando…
                  </div>
                  <div>
                    <button onClick={stopRec}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#E2445C", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      <Square size={16} /> Parar e processar
                    </button>
                  </div>
                  <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
                </div>
              )}

              {stage === "processing" && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
                  <Loader2 size={28} className="vc-spin" style={{ color: "var(--primary)" }} />
                  <p style={{ marginTop: 12, fontSize: 14 }}>Transcrevendo e organizando…</p>
                  <style>{`.vc-spin { animation: vcspin 1s linear infinite } @keyframes vcspin { to { transform: rotate(360deg) } }`}</style>
                </div>
              )}

              {stage === "review" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Tarefas */}
                  <section>
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <ListChecks size={15} /> Tarefas ({tasks.length})
                    </h3>
                    {tasks.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhuma tarefa detectada.</p> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {tasks.map((t, i) => (
                          <div key={i} style={{ border: "1px solid var(--card-border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input value={t.title} onChange={(e) => setTasks((p) => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} style={{ ...inp, flex: 1, fontWeight: 600 }} />
                              <button onClick={() => setTasks((p) => p.filter((_, j) => j !== i))} aria-label="Remover" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <select value={t.projectId} onChange={(e) => setTasks((p) => p.map((x, j) => j === i ? { ...x, projectId: e.target.value } : x))} style={{ ...inp, flex: "1 1 140px" }}>
                                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              <input type="date" value={t.dueDate} onChange={(e) => setTasks((p) => p.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))} style={{ ...inp, width: 150 }} />
                              <select value={t.priority} onChange={(e) => setTasks((p) => p.map((x, j) => j === i ? { ...x, priority: e.target.value as VTask["priority"] } : x))} style={{ ...inp, width: 110 }}>
                                <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Notas */}
                  <section>
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <FileText size={15} /> Notas ({notes.length})
                    </h3>
                    {notes.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhuma nota detectada.</p> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {notes.map((n, i) => (
                          <div key={i} style={{ border: "1px solid var(--card-border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input value={n.title} onChange={(e) => setNotes((p) => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="Título" style={{ ...inp, flex: 1, fontWeight: 600 }} />
                              <button onClick={() => setNotes((p) => p.filter((_, j) => j !== i))} aria-label="Remover" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>
                            </div>
                            <textarea value={n.body} onChange={(e) => setNotes((p) => p.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} rows={2} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {transcription && (
                    <details style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      <summary style={{ cursor: "pointer" }}>Ver transcrição</summary>
                      <p style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{transcription}</p>
                    </details>
                  )}
                </div>
              )}
            </div>

            {stage === "review" && (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 20px", borderTop: "1px solid var(--card-border)" }}>
                <button onClick={reset} style={{ background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Refazer</button>
                <button onClick={createAll} disabled={saving || (tasks.length === 0 && notes.length === 0)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>
                  <Check size={15} /> {saving ? "Criando…" : "Criar tudo"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
