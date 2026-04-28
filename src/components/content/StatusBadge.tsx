"use client";

import type { ContentStatus } from "@/lib/types";

export const STATUS_META: Record<ContentStatus, { label: string; color: string }> = {
  idea:           { label: "Ideia",       color: "#A0A0A0" },
  in_production:  { label: "Em produção", color: "#FDAB3D" },
  published:      { label: "Publicada",   color: "#00C875" },
  archived:       { label: "Arquivada",   color: "#6b6b6b" },
};

export const ALL_STATUSES: ContentStatus[] = ["idea", "in_production", "published", "archived"];

export function StatusBadge({
  status, onClick, compact,
}: { status: ContentStatus; onClick?: () => void; compact?: boolean }) {
  const meta = STATUS_META[status];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: `color-mix(in srgb, ${meta.color} 15%, transparent)`,
        color: meta.color,
        border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)`,
        borderRadius: 999,
        padding: compact ? "2px 10px" : "4px 14px",
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
      {meta.label}
    </Tag>
  );
}
