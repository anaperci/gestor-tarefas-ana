"use client";

import { useEffect } from "react";

export interface Shortcut {
  /** Tecla ou combinação. Ex: "n", "/", "?", "Escape", "mod+k". */
  combo: string;
  /** Descrição humana — usada no overlay de help. */
  description: string;
  /** Handler. Pode chamar e.preventDefault() se necessário. */
  handler: (e: KeyboardEvent) => void;
  /** Quando true, dispara mesmo se foco está em input/textarea. Default false. */
  allowInInputs?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function matches(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const key = parts[parts.length - 1];
  const needsMod = parts.includes("mod");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");

  const mod = e.ctrlKey || e.metaKey;
  if (needsMod !== mod) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;

  return e.key.toLowerCase() === key;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);
      for (const sc of shortcuts) {
        if (typing && !sc.allowInInputs) continue;
        if (matches(sc.combo, e)) {
          sc.handler(e);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts, enabled]);
}
