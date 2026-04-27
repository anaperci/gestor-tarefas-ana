"use client";

import { CSSProperties } from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: number | string;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 14, rounded = 6, style }: SkeletonProps) {
  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        borderRadius: rounded,
        background: "linear-gradient(90deg, var(--surface-hover) 25%, var(--surface-2) 50%, var(--surface-hover) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/** Lista de skeleton rows usada em listagens (tarefas, notas). */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Skeleton width={20} height={20} rounded={6} />
          <Skeleton width={`${40 + Math.random() * 40}%`} />
          <Skeleton width={80} height={22} rounded={20} style={{ marginLeft: "auto" }} />
        </div>
      ))}
    </div>
  );
}
