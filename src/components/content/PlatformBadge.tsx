"use client";

import type { ContentPlatform } from "@/lib/types";

export const PLATFORM_META: Record<ContentPlatform, { label: string; color: string }> = {
  instagram:  { label: "Instagram",  color: "#E4405F" },
  linkedin:   { label: "LinkedIn",   color: "#0A66C2" },
  youtube:    { label: "YouTube",    color: "#FF0000" },
  tiktok:     { label: "TikTok",     color: "#25F4EE" },
  newsletter: { label: "Newsletter", color: "#46347F" },
  multiple:   { label: "Múltiplas",  color: "#9B59B6" },
  other:      { label: "Outras",     color: "#A0A0A0" },
};

export const ALL_PLATFORMS: ContentPlatform[] = [
  "instagram", "linkedin", "youtube", "tiktok", "newsletter", "multiple", "other",
];

export function PlatformBadge({ platform }: { platform: ContentPlatform | null }) {
  if (!platform) return null;
  const meta = PLATFORM_META[platform];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, color: meta.color, fontWeight: 600,
    }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
      {meta.label}
    </span>
  );
}
