export function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("clareza-error", { detail: message }));
}
