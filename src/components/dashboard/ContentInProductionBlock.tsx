"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { ContentItem } from "@/lib/types";
import { BlockCard } from "./BlockCard";
import { FormatIcon } from "@/components/content/FormatIcon";
import { PLATFORM_META } from "@/components/content/PlatformBadge";

interface Props {
  currentUserId: string;
  delay?: number;
}

export function ContentInProductionBlock({ currentUserId, delay = 0 }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getContentItems({ status: ["in_production"], assignedTo: currentUserId })
      .then((data) => { if (!cancelled) setItems(data.slice(0, 5)); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentUserId]);

  return (
    <BlockCard
      icon={Sparkles}
      iconColor="var(--primary)"
      title="Conteúdo em produção"
      count={items?.length}
      borderLeft="var(--primary)"
      delay={delay}
      action={
        <button
          onClick={() => router.push("/content")}
          aria-label="Abrir Hub de Conteúdo"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--primary)", fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", padding: 0,
          }}
        >
          Abrir hub <ArrowRight size={12} aria-hidden />
        </button>
      }
    >
      {loading && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Carregando…</div>
      )}

      {!loading && items && items.length === 0 && (
        <button
          onClick={() => router.push("/content")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "transparent", border: "1px dashed var(--card-border)",
            borderRadius: 10, padding: "12px 14px", cursor: "pointer",
            color: "var(--text-muted)", fontSize: 13, fontFamily: "inherit",
            width: "100%", textAlign: "left",
          }}
        >
          <FileText size={14} aria-hidden />
          Nada em produção. Clique pra criar uma ideia no hub.
        </button>
      )}

      {!loading && items && items.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => {
            const platform = item.platform ? PLATFORM_META[item.platform] : null;
            const title = item.title.trim() || item.body.replace(/\s+/g, " ").trim().slice(0, 60) || "Sem título";
            return (
              <li key={item.id}>
                <button
                  onClick={() => router.push(`/content?item=${item.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", textAlign: "left",
                    padding: "8px 10px", borderRadius: 8,
                    background: "transparent", border: "1px solid transparent",
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "background 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--surface-hover)";
                    e.currentTarget.style.borderColor = "var(--card-border)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                  }}
                >
                  <FormatIcon format={item.format} color="var(--primary)" />
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {title}
                  </span>
                  {platform && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: platform.color,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: platform.color }} />
                      {platform.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BlockCard>
  );
}
