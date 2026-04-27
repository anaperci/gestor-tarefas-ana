"use client";

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { motion } from "framer-motion";

interface BlockCardProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  count?: number;
  action?: ReactNode;
  borderLeft?: string;
  children: ReactNode;
  delay?: number;
}

export function BlockCard({
  icon: Icon, iconColor = "var(--text-secondary)",
  title, count, action, borderLeft,
  children, delay = 0,
}: BlockCardProps) {
  return (
    <motion.section
      aria-label={title}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: borderLeft ? `3px solid ${borderLeft}` : undefined,
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Icon size={18} color={iconColor} aria-hidden />
        <h2 style={{
          margin: 0, fontFamily: "var(--font-poppins), Poppins, sans-serif",
          fontSize: 18, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em",
        }}>
          {title}
        </h2>
        {typeof count === "number" && (
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>
            {count}
          </span>
        )}
        {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
      </header>
      {children}
    </motion.section>
  );
}
