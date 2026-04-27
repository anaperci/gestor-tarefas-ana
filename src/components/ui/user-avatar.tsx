"use client";

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { adventurer } from "@dicebear/collection";

/** 8 seeds pré-definidos pra escolha — ficam variados visualmente */
export const AVATAR_SEEDS = [
  "Ada", "Buzz", "Coco", "Drift", "Echo", "Fox", "Gigi", "Holly",
] as const;

export type AvatarSeed = (typeof AVATAR_SEEDS)[number];

/** True se a string é só emoji (compat com avatares antigos) */
function looksLikeEmoji(s: string): boolean {
  if (!s) return true;
  // Aceita seqs curtas; emoji canonical é 1-4 chars
  if (s.length > 4) return false;
  return /\p{Extended_Pictographic}/u.test(s);
}

interface UserAvatarProps {
  /** Pode ser emoji legado OU um seed do DiceBear */
  avatar?: string | null;
  name: string;
  size?: number;
  /** Tom de fundo para o quadrado quando renderiza emoji */
  background?: string;
  className?: string;
}

export function UserAvatar({ avatar, name, size = 32, background, className }: UserAvatarProps) {
  const isEmoji = looksLikeEmoji(avatar ?? "");

  const dataUri = useMemo(() => {
    if (isEmoji) return null;
    const seed = avatar ?? name;
    return createAvatar(adventurer, {
      seed,
      backgroundColor: ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"],
      radius: 50,
    }).toDataUri();
  }, [avatar, name, isEmoji]);

  if (isEmoji) {
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
        {avatar || "👤"}
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
