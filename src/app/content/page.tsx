"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive, Calendar, Copy, FolderInput, Link2, Loader2, Plus,
  Search, Sparkles, Trash2, X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ContentFormat, ContentItem, ContentPlatform, ContentStatus, Project, User } from "@/lib/types";
import { useContentItem, useContentItems } from "@/lib/use-content";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContentListItem } from "@/components/content/ContentListItem";
import { CarouselSlideEditor } from "@/components/content/CarouselSlideEditor";
import { CommentsThread } from "@/components/content/CommentsThread";
import { ALL_FORMATS, FormatIcon, formatLabel } from "@/components/content/FormatIcon";
import { ALL_STATUSES, STATUS_META, StatusBadge } from "@/components/content/StatusBadge";
import { ALL_PLATFORMS, PLATFORM_META } from "@/components/content/PlatformBadge";

interface Filters {
  status: ContentStatus[];
  format: ContentFormat[];
  platform: ContentPlatform | "all";
  assignedTo: string | "all" | "me" | "other";
  search: string;
}

const DEFAULT_FILTERS: Filters = {
  status: ["idea", "in_production"],
  format: [],
  platform: "all",
  assignedTo: "all",
  search: "",
};

const FILTERS_STORAGE_KEY_PREFIX = "ordum-content-filters:";

export default function ContentPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: "var(--text-muted)" }}>Carregando…</div>}>
      <ContentPageInner />
    </Suspense>
  );
}

function ContentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialItemId = searchParams.get("item");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accessChecked, setAccessChecked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialItemId);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Carrega user atual + lista de users + projetos ─────────────────
  useEffect(() => {
    api.me().then(async (me) => {
      if (!me.canAccessContent) {
        router.replace("/");
        return;
      }
      setCurrentUser(me);
      setAccessChecked(true);
      const [u, p] = await Promise.all([api.getUsers(), api.getProjects()]);
      setUsers(u);
      setProjects(p);
    }).catch(() => {
      router.replace("/");
    });
  }, [router]);

  // ── Restaura filtros do localStorage ───────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const key = FILTERS_STORAGE_KEY_PREFIX + currentUser.id;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { setFilters(JSON.parse(saved)); } catch {}
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(FILTERS_STORAGE_KEY_PREFIX + currentUser.id, JSON.stringify(filters));
  }, [filters, currentUser]);

  // ── Resolve assignedTo "me"/"other" pra ID concreto ────────────────
  const resolvedAssignedTo = useMemo(() => {
    if (!currentUser) return undefined;
    if (filters.assignedTo === "all") return undefined;
    if (filters.assignedTo === "me") return currentUser.id;
    if (filters.assignedTo === "other") {
      const other = users.find((u) => u.id !== currentUser.id && u.canAccessContent);
      return other?.id;
    }
    return filters.assignedTo;
  }, [filters.assignedTo, currentUser, users]);

  const listFilters = useMemo(() => ({
    status: filters.status,
    format: filters.format,
    platform: filters.platform === "all" ? undefined : filters.platform,
    assignedTo: resolvedAssignedTo,
    search: filters.search || undefined,
  }), [filters, resolvedAssignedTo]);

  const { items = [], mutate: mutateList, isLoading: listLoading } = useContentItems(listFilters);

  // ── Auto-seleciona primeiro item quando lista muda ─────────────────
  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0].id);
    if (selectedId && items.length > 0 && !items.find((i) => i.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  // ── Atalhos globais ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing) return;
      if (e.key === "n" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); createNew(); }
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "j" || e.key === "k") {
        if (items.length === 0) return;
        const idx = items.findIndex((i) => i.id === selectedId);
        const nextIdx = e.key === "j" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
        setSelectedId(items[nextIdx]?.id ?? null);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, items, selectedId]);

  const createNew = useCallback(async () => {
    const created = await api.createContentItem({});
    await mutateList();
    setSelectedId(created.id);
  }, [mutateList]);

  if (!accessChecked || !currentUser) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={18} className="spin" /> Verificando acesso…
        </div>
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <ContentTopBar
        filters={filters}
        onFiltersChange={setFilters}
        onNewIdea={createNew}
        currentUser={currentUser}
        users={users}
        searchRef={searchRef}
        onBackHome={() => router.push("/")}
      />

      {/* ── 3 painéis ──────────────────────────────────────────────── */}
      <div className="content-shell" style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr 300px", minHeight: 0 }}>
        {/* Lista */}
        <aside style={{
          padding: "16px 12px",
          background: "color-mix(in srgb, var(--primary) 2%, var(--surface))",
          borderRight: "1px solid var(--card-border)",
          overflowY: "auto",
        }}>
          {listLoading && items.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>Carregando…</div>
          ) : items.length === 0 ? (
            <EmptyList onNew={createNew} />
          ) : (
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <ContentListItem
                  key={item.id}
                  item={item}
                  active={item.id === selectedId}
                  onClick={() => setSelectedId(item.id)}
                  users={users}
                />
              ))}
            </AnimatePresence>
          )}
        </aside>

        {/* Editor */}
        <section style={{ overflowY: "auto", padding: "32px", background: "var(--surface)" }}>
          {selectedId ? (
            <ContentEditor
              key={selectedId}
              contentId={selectedId}
              currentUser={currentUser}
              users={users}
              projects={projects}
              onMutateList={mutateList}
              onSelect={setSelectedId}
            />
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-muted)" }}>
              Selecione uma ideia ou crie uma nova.
            </div>
          )}
        </section>

        {/* Meta + comments */}
        <aside style={{
          padding: 20,
          background: "color-mix(in srgb, var(--primary) 2%, var(--surface))",
          borderLeft: "1px solid var(--card-border)",
          overflowY: "auto",
        }}>
          {selectedId && (
            <MetaAndComments
              contentId={selectedId}
              currentUser={currentUser}
              users={users}
              projects={projects}
            />
          )}
        </aside>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1279px) {
          .content-shell { grid-template-columns: 320px 1fr !important; }
          .content-shell > aside:last-of-type { display: none; }
        }
        @media (max-width: 1023px) {
          .content-shell { grid-template-columns: 1fr !important; }
          .content-shell > aside:first-of-type {
            display: ${selectedId ? "none" : "block"};
          }
          .content-shell > section {
            display: ${selectedId ? "block" : "none"};
          }
        }
      `}</style>
    </main>
  );
}

// ─── TOP BAR ───────────────────────────────────────────────────────────

function ContentTopBar({
  filters, onFiltersChange, onNewIdea, currentUser, users, searchRef, onBackHome,
}: {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  onNewIdea: () => void;
  currentUser: User;
  users: User[];
  searchRef: React.RefObject<HTMLInputElement | null>;
  onBackHome: () => void;
}) {
  const otherUser = users.find((u) => u.id !== currentUser.id && u.canAccessContent);

  const toggleStatus = (s: ContentStatus) => {
    const set = new Set(filters.status);
    if (set.has(s)) set.delete(s); else set.add(s);
    onFiltersChange({ ...filters, status: Array.from(set) });
  };

  const toggleFormat = (f: ContentFormat) => {
    const set = new Set(filters.format);
    if (set.has(f)) set.delete(f); else set.add(f);
    onFiltersChange({ ...filters, format: Array.from(set) });
  };

  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      padding: "14px 20px",
      background: "var(--surface)",
      borderBottom: "1px solid var(--card-border)",
    }}>
      <button onClick={onBackHome} title="Voltar pro app" aria-label="Voltar"
        style={{ background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
        ← App
      </button>

      <button onClick={onNewIdea} aria-keyshortcuts="N"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--primary)", color: "#fff", border: "none",
          padding: "8px 16px", borderRadius: 10, cursor: "pointer",
          fontSize: 13, fontWeight: 700, fontFamily: "inherit",
          boxShadow: "0 4px 14px var(--primary-ring)",
        }}>
        <Plus size={14} aria-hidden /> Nova ideia
        <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.85, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.18)" }}>N</span>
      </button>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 4 }}>
        {ALL_STATUSES.map((s) => {
          const active = filters.status.includes(s);
          const meta = STATUS_META[s];
          return (
            <button key={s} onClick={() => toggleStatus(s)}
              aria-pressed={active}
              style={{
                padding: "5px 11px", borderRadius: 999,
                border: `1.5px solid ${active ? meta.color : "var(--card-border)"}`,
                background: active ? `color-mix(in srgb, ${meta.color} 14%, transparent)` : "transparent",
                color: active ? meta.color : "var(--text-secondary)",
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Format icons */}
      <div style={{ display: "flex", gap: 2 }}>
        {ALL_FORMATS.map((f) => {
          const active = filters.format.includes(f);
          return (
            <button key={f} onClick={() => toggleFormat(f)}
              aria-pressed={active} title={formatLabel(f)} aria-label={formatLabel(f)}
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: "1px solid var(--card-border)",
                background: active ? "var(--primary-soft)" : "transparent",
                color: active ? "var(--primary)" : "var(--text-secondary)",
                cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
              <FormatIcon format={f} size={14} />
            </button>
          );
        })}
      </div>

      {/* Platform select */}
      <select value={filters.platform}
        onChange={(e) => onFiltersChange({ ...filters, platform: e.target.value as Filters["platform"] })}
        style={selectStyle}>
        <option value="all">Todas plataformas</option>
        {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
      </select>

      {/* Assigned filter */}
      <select value={filters.assignedTo}
        onChange={(e) => onFiltersChange({ ...filters, assignedTo: e.target.value as Filters["assignedTo"] })}
        style={selectStyle}>
        <option value="all">Todos</option>
        <option value="me">Minhas</option>
        {otherUser && <option value="other">Da {otherUser.name.split(" ")[0]}</option>}
      </select>

      {/* Busca */}
      <div style={{ position: "relative", marginLeft: "auto" }}>
        <span aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex" }}>
          <Search size={14} />
        </span>
        <input
          ref={searchRef}
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Buscar (atalho /)"
          aria-label="Buscar conteúdos"
          style={{
            width: 200, padding: "7px 12px 7px 32px",
            background: "var(--input-bg)", border: "1px solid var(--card-border)",
            color: "var(--text)", fontSize: 13, outline: "none",
            borderRadius: 10, fontFamily: "inherit",
          }}
        />
      </div>
    </header>
  );
}

function EmptyList({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ padding: "48px 16px", textAlign: "center" }}>
      <Sparkles size={48} color="var(--primary)" style={{ opacity: 0.3, margin: "0 auto" }} aria-hidden />
      <p style={{ marginTop: 14, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Nenhuma ideia ainda.<br />Bora começar?
      </p>
      <button onClick={onNew}
        style={{
          marginTop: 12, padding: "8px 16px", borderRadius: 10, border: "none",
          background: "var(--primary)", color: "#fff", cursor: "pointer",
          fontSize: 13, fontWeight: 700, fontFamily: "inherit",
        }}>
        + Nova ideia
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "var(--input-bg)", border: "1px solid var(--card-border)",
  color: "var(--text)", fontSize: 12, padding: "6px 10px", borderRadius: 8,
  cursor: "pointer", fontFamily: "inherit", outline: "none",
};

// ─── EDITOR ────────────────────────────────────────────────────────────

function ContentEditor({
  contentId, currentUser, users, projects, onMutateList, onSelect,
}: {
  contentId: string;
  currentUser: User;
  users: User[];
  projects: Project[];
  onMutateList: () => Promise<unknown>;
  onSelect: (id: string | null) => void;
}) {
  const { item, slides, mutateItem, mutateSlides, refreshLists } = useContentItem(contentId);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftHook, setDraftHook] = useState("");
  const [draftCta, setDraftCta] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftPreview, setDraftPreview] = useState("");
  const [draftDuration, setDraftDuration] = useState<string>("");
  const [draftPubUrl, setDraftPubUrl] = useState("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!item) return;
    setDraftTitle(item.title);
    setDraftBody(item.body);
    setDraftHook(item.hook);
    setDraftCta(item.cta);
    setDraftSubject(item.subjectLine);
    setDraftPreview(item.previewText);
    setDraftDuration(item.durationSeconds?.toString() ?? "");
    setDraftPubUrl(item.publishedUrl);
  }, [item]);

  const flush = useCallback(async (overrides: Partial<ContentItem> = {}) => {
    if (!item) return;
    setSavingState("saving");
    const payload: Record<string, unknown> = {};
    if (draftTitle !== item.title) payload.title = draftTitle;
    if (draftBody !== item.body) payload.body = draftBody;
    if (draftHook !== item.hook) payload.hook = draftHook;
    if (draftCta !== item.cta) payload.cta = draftCta;
    if (draftSubject !== item.subjectLine) payload.subjectLine = draftSubject;
    if (draftPreview !== item.previewText) payload.previewText = draftPreview;
    const dur = draftDuration === "" ? null : parseInt(draftDuration, 10);
    if (dur !== item.durationSeconds) payload.durationSeconds = dur;
    if (draftPubUrl !== item.publishedUrl) payload.publishedUrl = draftPubUrl;
    Object.assign(payload, overrides);

    if (Object.keys(payload).length === 0) { setSavingState("idle"); return; }
    const updated = await api.updateContentItem(item.id, payload);
    await mutateItem(updated, false);
    refreshLists();
    setSavingState("saved");
    setTimeout(() => setSavingState("idle"), 1400);
  }, [draftTitle, draftBody, draftHook, draftCta, draftSubject, draftPreview, draftDuration, draftPubUrl, item, mutateItem, refreshLists]);

  // Auto-save 800ms debounce
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush(), 800);
  }, [flush]);

  // Cmd/Ctrl+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
        flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  if (!item) return null;

  const isPublished = item.status === "published";
  const showHookCta = item.format === "post" || item.format === "thread" || item.format === "video_short" || item.format === "video_long" || item.format === "carousel";
  const showVideoFields = item.format === "video_short" || item.format === "video_long";
  const showEmailFields = item.format === "email";
  const showCarousel = item.format === "carousel";

  const updateMeta = async (patch: Record<string, unknown>) => {
    setSavingState("saving");
    const updated = await api.updateContentItem(item.id, patch);
    await mutateItem(updated, false);
    refreshLists();
    setSavingState("saved");
    setTimeout(() => setSavingState("idle"), 1200);
  };

  return (
    <div style={{
      maxWidth: 760, margin: "0 auto",
      background: isPublished ? "color-mix(in srgb, var(--status-done) 3%, transparent)" : undefined,
      padding: isPublished ? 16 : 0, borderRadius: 12,
    }}>
      {/* Título */}
      <input
        value={draftTitle}
        onChange={(e) => { setDraftTitle(e.target.value); scheduleSave(); }}
        onBlur={() => flush()}
        placeholder="Título da ideia..."
        style={{
          width: "100%", padding: "8px 0", marginBottom: 12,
          background: "transparent", border: "none",
          fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontSize: 30, fontWeight: 600, color: "var(--text)",
          outline: "none", letterSpacing: "-0.02em",
        }}
      />

      {/* Linha de meta */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 24 }}>
        <SelectInline value={item.status}
          options={ALL_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
          onChange={(v) => updateMeta({ status: v })}
          render={() => <StatusBadge status={item.status} compact />}
        />
        <SelectInline value={item.format}
          options={ALL_FORMATS.map((f) => ({ value: f, label: formatLabel(f) }))}
          onChange={(v) => updateMeta({ format: v })}
          render={() => (
            <span style={pillStyle}>
              <FormatIcon format={item.format} /> {formatLabel(item.format)}
            </span>
          )}
        />
        <SelectInline value={item.platform ?? ""}
          options={[{ value: "", label: "Sem plataforma" }, ...ALL_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_META[p].label }))]}
          onChange={(v) => updateMeta({ platform: v === "" ? null : v })}
          render={() => (
            <span style={pillStyle}>
              {item.platform ? PLATFORM_META[item.platform].label : "Sem plataforma"}
            </span>
          )}
        />
        <SelectInline value={item.assignedTo ?? ""}
          options={[{ value: "", label: "Sem responsável" }, ...users.filter((u) => u.canAccessContent).map((u) => ({ value: u.id, label: u.name }))]}
          onChange={(v) => updateMeta({ assignedTo: v === "" ? null : v })}
          render={() => {
            const assignee = users.find((u) => u.id === item.assignedTo);
            return assignee
              ? <span style={pillStyle}><UserAvatar avatar={assignee.avatar} name={assignee.name} size={18} /> {assignee.name.split(" ")[0]}</span>
              : <span style={pillStyle}>Sem responsável</span>;
          }}
        />

        <button onClick={() => setShowProjectPicker(true)} style={pillStyle as React.CSSProperties}>
          <FolderInput size={12} aria-hidden />
          {item.linkedProjectId
            ? projects.find((p) => p.id === item.linkedProjectId)?.name ?? "Projeto"
            : "Vincular projeto"}
        </button>

        {savingState !== "idle" && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
            {savingState === "saving" ? "salvando…" : "salvo"}
          </span>
        )}
      </div>

      {/* Body principal (não-carousel) */}
      {!showCarousel && (
        <textarea
          value={draftBody}
          onChange={(e) => { setDraftBody(e.target.value); scheduleSave(); }}
          onBlur={() => flush()}
          placeholder="Comece a escrever sua ideia..."
          rows={Math.max(8, draftBody.split("\n").length + 1)}
          style={{
            width: "100%", padding: "12px 0",
            background: "transparent", border: "none",
            color: "var(--text)", fontSize: 16, lineHeight: 1.7,
            outline: "none", fontFamily: "inherit", resize: "none",
          }}
        />
      )}

      {/* Hook + CTA condicional */}
      {showHookCta && (
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Gancho / Abertura">
            <textarea value={draftHook} onChange={(e) => { setDraftHook(e.target.value); scheduleSave(); }}
              onBlur={() => flush()} rows={2} style={textareaSmall} placeholder="Os primeiros 3 segundos..." />
          </Field>
          <Field label="Chamada / CTA">
            <textarea value={draftCta} onChange={(e) => { setDraftCta(e.target.value); scheduleSave(); }}
              onBlur={() => flush()} rows={2} style={textareaSmall} placeholder="O que você quer que façam depois?" />
          </Field>
        </div>
      )}

      {/* Vídeo */}
      {showVideoFields && (
        <div style={{ marginTop: 16 }}>
          <Field label="Duração estimada (segundos)">
            <input type="number" value={draftDuration}
              onChange={(e) => { setDraftDuration(e.target.value); scheduleSave(); }}
              onBlur={() => flush()} placeholder="Ex: 60" min={0}
              style={inputStyle} />
          </Field>
        </div>
      )}

      {/* Email */}
      {showEmailFields && (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Subject line">
            <input value={draftSubject} onChange={(e) => { setDraftSubject(e.target.value); scheduleSave(); }}
              onBlur={() => flush()} placeholder="Assunto do email"
              style={inputStyle} />
          </Field>
          <Field label="Preview text">
            <input value={draftPreview} onChange={(e) => { setDraftPreview(e.target.value); scheduleSave(); }}
              onBlur={() => flush()} placeholder="Texto de preview na inbox"
              style={inputStyle} />
          </Field>
        </div>
      )}

      {/* Carousel */}
      {showCarousel && (
        <CarouselSlideEditor
          contentItemId={item.id}
          slides={slides}
          onChange={() => mutateSlides()}
        />
      )}

      {/* Publicado */}
      {isPublished && (
        <div style={{ marginTop: 24 }}>
          <Field label="URL publicada">
            <input value={draftPubUrl} onChange={(e) => { setDraftPubUrl(e.target.value); scheduleSave(); }}
              onBlur={() => flush()} placeholder="https://…"
              style={inputStyle} />
          </Field>
        </div>
      )}

      {/* Ações sticky bottom */}
      <div style={{
        marginTop: 32, paddingTop: 16,
        borderTop: "1px solid var(--card-border)",
        display: "flex", flexWrap: "wrap", gap: 8,
      }}>
        <ActionButton icon={<FolderInput size={13} />}
          onClick={async () => {
            if (!item.linkedProjectId) {
              setShowProjectPicker(true);
              return;
            }
            const r = await api.transformContentToTask(item.id);
            if (r.alreadyLinked) {
              alert("Já existe tarefa vinculada.");
            } else {
              await mutateItem();
              alert("Tarefa criada!");
            }
          }}>
          {item.linkedTaskId ? "Ver tarefa vinculada" : "Transformar em tarefa"}
        </ActionButton>
        <ActionButton icon={<Copy size={13} />}
          onClick={async () => {
            const dup = await api.createContentItem({
              title: item.title ? `${item.title} (cópia)` : "",
              body: item.body, format: item.format,
            });
            await onMutateList();
            onSelect(dup.id);
          }}>
          Duplicar
        </ActionButton>
        <ActionButton icon={<Archive size={13} />}
          onClick={() => updateMeta({ status: item.status === "archived" ? "idea" : "archived" })}>
          {item.status === "archived" ? "Desarquivar" : "Arquivar"}
        </ActionButton>
        <ActionButton icon={<Trash2 size={13} />} destructive
          onClick={() => setConfirmDelete(true)}>
          Excluir
        </ActionButton>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir esta ideia?"
        description="A ideia, comentários e slides serão arquivados (soft delete)."
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          await api.deleteContentItem(item.id);
          setConfirmDelete(false);
          await onMutateList();
          onSelect(null);
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Project picker simples (modal) */}
      {showProjectPicker && (
        <div role="dialog" aria-modal="true"
          onClick={() => setShowProjectPicker(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "var(--overlay)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--surface)", border: "1px solid var(--card-border)",
            borderRadius: 12, padding: 20, width: "min(420px, 92vw)",
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Vincular a um projeto</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {projects.map((p) => (
                <button key={p.id}
                  onClick={async () => {
                    await updateMeta({ linkedProjectId: p.id });
                    setShowProjectPicker(false);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 8,
                    border: "1px solid var(--card-border)",
                    background: "var(--surface)",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}>
                  <span style={{ fontSize: 18 }} aria-hidden>{p.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{p.name}</span>
                </button>
              ))}
              {projects.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                  Você ainda não tem projetos visíveis.
                </div>
              )}
            </div>
            {item.linkedProjectId && (
              <button onClick={async () => { await updateMeta({ linkedProjectId: null }); setShowProjectPicker(false); }}
                style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Remover vínculo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── META + COMMENTS PANEL ─────────────────────────────────────────────

function MetaAndComments({
  contentId, currentUser, users, projects,
}: {
  contentId: string;
  currentUser: User;
  users: User[];
  projects: Project[];
}) {
  const { item, comments, mutateComments } = useContentItem(contentId);

  if (!item) return null;
  const creator = users.find((u) => u.id === item.createdBy);
  const lastEditor = users.find((u) => u.id === item.lastEditedBy);
  const project = projects.find((p) => p.id === item.linkedProjectId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section>
        <header style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", marginBottom: 10 }}>
          Detalhes
        </header>
        <dl style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, margin: 0 }}>
          <KV label="Criada por" value={creator ? <><UserAvatar avatar={creator.avatar} name={creator.name} size={18} /> {creator.name}</> : "?"} />
          <KV label="Criada em" value={new Date(item.createdAt).toLocaleString("pt-BR")} />
          <KV label="Última edição" value={`${new Date(item.updatedAt).toLocaleString("pt-BR")}${lastEditor ? ` · ${lastEditor.name.split(" ")[0]}` : ""}`} />
          <KV label="Projeto" value={project ? <span style={{ color: project.color, fontWeight: 600 }}>{project.icon} {project.name}</span> : "—"} />
          {item.linkedTaskId && <KV label="Tarefa" value={<span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{item.linkedTaskId}</span>} />}
          {item.tags.length > 0 && <KV label="Tags" value={item.tags.join(", ")} />}
          {item.targetAudience && <KV label="Audiência" value={item.targetAudience} />}
        </dl>
      </section>

      <CommentsThread
        contentItemId={item.id}
        comments={comments}
        currentUser={currentUser}
        users={users}
        onChange={() => mutateComments()}
      />
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <dt style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</dt>
      <dd style={{ color: "var(--text)", margin: 0, textAlign: "right", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        {value}
      </dd>
    </div>
  );
}

// ─── shared little helpers ─────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--text-muted)", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ActionButton({ icon, children, onClick, destructive }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; destructive?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 14px", borderRadius: 8,
        border: `1px solid ${destructive ? "rgba(226,68,92,0.3)" : "var(--card-border)"}`,
        background: destructive ? "rgba(226,68,92,0.08)" : "var(--surface)",
        color: destructive ? "#E2445C" : "var(--text)",
        cursor: "pointer", fontSize: 12, fontWeight: 600,
        fontFamily: "inherit",
      }}>
      {icon} {children}
    </button>
  );
}

function SelectInline<T extends string>({ value, options, onChange, render }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  render: () => React.ReactNode;
}) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {render()}
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          opacity: 0, cursor: "pointer", border: "none", background: "transparent",
        }}>
        {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </span>
  );
}

const pillStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "5px 11px", borderRadius: 999,
  border: "1px solid var(--card-border)",
  background: "var(--surface)", color: "var(--text)",
  fontSize: 12, cursor: "pointer", fontFamily: "inherit",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px",
  background: "var(--input-bg)", border: "1px solid var(--input-border)",
  color: "var(--text)", fontSize: 13, outline: "none",
  fontFamily: "inherit", borderRadius: 8,
};

const textareaSmall: React.CSSProperties = {
  ...inputStyle, lineHeight: 1.5, resize: "vertical",
};
