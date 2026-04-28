"use client";

import { motion } from "framer-motion";
import type { ContentItem, User } from "@/lib/types";
import { UserAvatar } from "@/components/ui/user-avatar";
import { FormatIcon } from "./FormatIcon";
import { PlatformBadge, PLATFORM_META } from "./PlatformBadge";
import { STATUS_META } from "./StatusBadge";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

interface Props {
  item: ContentItem;
  active: boolean;
  onClick: () => void;
  users: User[];
}

export function ContentListItem({ item, active, onClick, users }: Props) {
  const assignee = users.find((u) => u.id === item.assignedTo);
  const status = STATUS_META[item.status];
  const titleFallback = item.body.replace(/\s+/g, " ").trim().slice(0, 50) || "Sem título";
  const visibleTitle = item.title.trim() || titleFallback;

  return (
    <motion.button
      layout
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--card-border)",
        background: active ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "var(--surface)",
        cursor: "pointer",
        marginBottom: 6,
        position: "relative",
        fontFamily: "inherit",
        boxShadow: active ? "var(--card-shadow)" : "none",
        transition: "background 0.15s",
        borderLeft: active ? "3px solid var(--primary)" : "1px solid var(--card-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <FormatIcon format={item.format} color={status.color} />
        <span style={{
          flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontStyle: !item.title.trim() ? "italic" : "normal",
          opacity: !item.title.trim() ? 0.7 : 1,
        }}>
          {visibleTitle}
        </span>
        {assignee && (
          <UserAvatar avatar={assignee.avatar} name={assignee.name} size={20} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
        <span style={{
          padding: "1px 8px", borderRadius: 999,
          background: `color-mix(in srgb, ${status.color} 15%, transparent)`,
          color: status.color, fontWeight: 600,
        }}>{status.label}</span>
        <PlatformBadge platform={item.platform} />
        <span style={{ marginLeft: "auto" }}>{relTime(item.updatedAt)}</span>
      </div>
      {item.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {item.tags.slice(0, 3).map((t, i) => (
            <span key={`${t}-${i}`} style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 4,
              background: "var(--surface-hover)", color: "var(--text-secondary)",
            }}>{t}</span>
          ))}
          {item.tags.length > 3 && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{item.tags.length - 3}</span>
          )}
        </div>
      )}
    </motion.button>
  );
}

export { PLATFORM_META };
