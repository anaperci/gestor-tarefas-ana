"use client";

import { useMemo } from "react";
import { createAvatar, type Style } from "@dicebear/core";
import { adventurer, notionists, personas, avataaars } from "@dicebear/collection";

/** 8 seeds compartilhados entre os 4 estilos */
export const AVATAR_SEEDS = [
  "Ada", "Buzz", "Coco", "Drift", "Echo", "Fox", "Gigi", "Holly",
] as const;
export type AvatarSeed = (typeof AVATAR_SEEDS)[number];

/** Estilos suportados — chave usada como prefixo no campo `avatar` */
export const AVATAR_STYLES = [
  { id: "adventurer", label: "Aventureiro",  hint: "fofo, chibi",        style: adventurer  as unknown as Style<object> },
  { id: "notionists", label: "Notion",       hint: "linha minimalista",  style: notionists  as unknown as Style<object> },
  { id: "personas",   label: "Persona",      hint: "ilustração formal",  style: personas    as unknown as Style<object> },
  { id: "avataaars",  label: "Clássico",     hint: "estilo executivo",   style: avataaars   as unknown as Style<object> },
] as const;

export type AvatarStyleId = (typeof AVATAR_STYLES)[number]["id"];
const STYLE_BY_ID = new Map<AvatarStyleId, Style<object>>(
  AVATAR_STYLES.map((s) => [s.id, s.style as Style<object>])
);

const BACKGROUND_COLORS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"];

function looksLikeEmoji(s: string): boolean {
  if (!s) return true;
  if (s.length > 4) return false;
  return /\p{Extended_Pictographic}/u.test(s);
}

/** Faz parse do campo `avatar`. Aceita "style:seed", "seed" (legacy = adventurer) ou emoji. */
export function parseAvatar(raw: string | null | undefined): {
  kind: "emoji" | "dicebear";
  emoji?: string;
  styleId?: AvatarStyleId;
  seed?: string;
} {
  if (!raw) return { kind: "emoji", emoji: "👤" };
  if (looksLikeEmoji(raw)) return { kind: "emoji", emoji: raw };
  if (raw.includes(":")) {
    const [styleId, seed] = raw.split(":", 2);
    if (STYLE_BY_ID.has(styleId as AvatarStyleId) && seed) {
      return { kind: "dicebear", styleId: styleId as AvatarStyleId, seed };
    }
  }
  // Legacy seed sem prefixo → adventurer
  return { kind: "dicebear", styleId: "adventurer", seed: raw };
}

/** Monta o id "style:seed" a partir das partes — usado pelo picker. */
export function composeAvatar(styleId: AvatarStyleId, seed: string): string {
  return `${styleId}:${seed}`;
}

interface UserAvatarProps {
  avatar?: string | null;
  name: string;
  size?: number;
  background?: string;
  className?: string;
}

export function UserAvatar({ avatar, name, size = 32, background, className }: UserAvatarProps) {
  const parsed = useMemo(() => parseAvatar(avatar), [avatar]);

  const dataUri = useMemo(() => {
    if (parsed.kind !== "dicebear" || !parsed.styleId || !parsed.seed) return null;
    const style = STYLE_BY_ID.get(parsed.styleId);
    if (!style) return null;
    return createAvatar(style, {
      seed: parsed.seed,
      backgroundColor: BACKGROUND_COLORS,
      radius: 50,
    }).toDataUri();
  }, [parsed]);

  if (parsed.kind === "emoji") {
    return (
      <span
        aria-label={name}
        title={name}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: "50%",
          background: background ?? "var(--primary-soft)",
          fontSize: Math.round(size * 0.55),
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {parsed.emoji}
      </span>
    );
  }

  return (
    <img
      src={dataUri ?? ""}
      alt={name}
      title={name}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "block",
        background: background ?? "var(--primary-soft)",
      }}
    />
  );
}
