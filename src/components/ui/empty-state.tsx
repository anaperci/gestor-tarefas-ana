"use client";

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Tamanho do espaço — "sm" pra cards, "md" (default) pra páginas */
  size?: "sm" | "md";
}

export function EmptyState({ icon: Icon, title, description, action, size = "md" }: EmptyStateProps) {
  const padding = size === "sm" ? 30 : 60;
  const iconSize = size === "sm" ? 32 : 44;

  return (
    <div
      style={{
        textAlign: "center",
        padding: `${padding}px 24px`,
        color: "var(--text-muted)",
      }}
    >
      <div
        aria-hidden
        style={{
          width: iconSize + 24,
          height: iconSize + 24,
          margin: "0 auto 16px",
          borderRadius: "50%",
          background: "var(--primary-soft)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={iconSize} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: size === "sm" ? 14 : 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}
