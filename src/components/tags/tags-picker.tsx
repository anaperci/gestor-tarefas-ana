"use client";

import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Tag as TagIcon } from "lucide-react";
import type { Tag } from "@/lib/types";

interface TagsPickerProps {
  allTags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** "compact" para usar dentro da tabela; "full" para dentro do drawer */
  variant?: "compact" | "full";
}

export function TagsPicker({ allTags, selectedIds, onChange, disabled, variant = "compact" }: TagsPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  const selectedTags = selectedIds.map((id) => tagsById.get(id)).filter((t): t is Tag => !!t);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuW = Math.max(rect.width, 220);
    setPos({
      top: rect.bottom + 4,
      left: rect.left + menuW > window.innerWidth - 12
        ? Math.max(8, window.innerWidth - menuW - 12)
        : rect.left,
      width: menuW,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  const pad = variant === "compact" ? "2px 6px" : "4px 10px";

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen((o) => !o); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 4,
          background: "transparent", border: "none", padding: 0, cursor: disabled ? "default" : "pointer",
          fontFamily: "inherit", textAlign: "left", flexWrap: "wrap",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {selectedTags.length === 0 ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, color: "var(--text-muted)",
            border: `1px dashed var(--border-strong)`, borderRadius: 6,
            padding: "3px 8px",
          }}>
            <TagIcon size={12} aria-hidden /> sem tag
          </span>
        ) : (
          <>
            {selectedTags.slice(0, variant === "compact" ? 2 : 99).map((t) => (
              <TagChip key={t.id} tag={t} pad={pad} />
            ))}
            {variant === "compact" && selectedTags.length > 2 && (
              <span style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                background: "var(--surface-2)", padding: "2px 6px", borderRadius: 6,
              }}>
                +{selectedTags.length - 2}
              </span>
            )}
          </>
        )}
      </button>

      {open && !disabled && pos && typeof window !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: "fixed",
            top: pos.top, left: pos.left, minWidth: pos.width,
            maxWidth: 280, maxHeight: 280,
            zIndex: 9999, overflowY: "auto",
            background: "var(--dropdown-bg)", borderRadius: 10, padding: 4,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: `1px solid var(--card-border)`,
            animation: "fadeIn 0.12s ease-out",
          }}
        >
          {allTags.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
              Nenhuma etiqueta criada.
              <br />Vá em <strong style={{ color: "var(--text-secondary)" }}>Painel Admin → Etiquetas</strong>.
            </div>
          ) : allTags.map((t) => {
            const checked = selectedIds.includes(t.id);
            return (
              <button
                key={t.id}
                role="option"
                aria-selected={checked}
                onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                style={{
                  display: "flex", width: "100%", padding: "7px 10px", border: "none",
                  background: "transparent", color: "var(--text)",
                  borderRadius: 7, cursor: "pointer", textAlign: "left", fontSize: 13,
                  fontFamily: "inherit", alignItems: "center", gap: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--dropdown-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span aria-hidden style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: `2px solid ${checked ? "var(--primary)" : "var(--border-strong)"}`,
                  background: checked ? "var(--primary)" : "transparent",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {checked && <Check size={11} color="#fff" strokeWidth={3} />}
                </span>
                <TagChip tag={t} pad="2px 8px" />
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── chip helper ───────────────────────────────────────────────────────

function TagChip({ tag, pad }: { tag: Tag; pad: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: pad, borderRadius: 999,
      background: `color-mix(in srgb, ${tag.color} 18%, transparent)`,
      color: tag.color,
      fontSize: 11, fontWeight: 600,
      whiteSpace: "nowrap",
      maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis",
    } as CSSProperties}>
      {tag.name}
    </span>
  );
}
