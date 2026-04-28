"use client";

import {
  AlignJustify, FileText, Film, GraduationCap, LayoutGrid, type LucideIcon,
  Mail, Square, Video,
} from "lucide-react";
import type { ContentFormat } from "@/lib/types";

const ICON_BY_FORMAT: Record<ContentFormat, LucideIcon> = {
  post: FileText,
  carousel: LayoutGrid,
  video_short: Video,
  video_long: Film,
  script_class: GraduationCap,
  email: Mail,
  thread: AlignJustify,
  other: Square,
};

const LABEL_BY_FORMAT: Record<ContentFormat, string> = {
  post: "Post",
  carousel: "Carrossel",
  video_short: "Vídeo curto",
  video_long: "Vídeo longo",
  script_class: "Aula",
  email: "Email",
  thread: "Thread",
  other: "Outro",
};

export const ALL_FORMATS: ContentFormat[] = [
  "post", "carousel", "video_short", "video_long", "script_class", "email", "thread", "other",
];

export function formatLabel(f: ContentFormat): string {
  return LABEL_BY_FORMAT[f];
}

export function FormatIcon({ format, size = 14, color }: { format: ContentFormat; size?: number; color?: string }) {
  const Icon = ICON_BY_FORMAT[format] ?? Square;
  return <Icon size={size} color={color} aria-label={LABEL_BY_FORMAT[format]} />;
}
