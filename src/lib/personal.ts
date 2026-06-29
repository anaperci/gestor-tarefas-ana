import { supabase } from "@/lib/supabase";

// Projeto "Pessoal" por usuário: id determinístico, sem workspace.
// Como get_user_projects retorna projetos onde owner_id = usuário, ele
// aparece só pro dono e NUNCA dentro de um workspace na sidebar.
const PERSONAL_COLOR = "#15708C";

export function personalProjectId(userId: string): string {
  return `personal-${userId}`;
}

export function isPersonalProjectId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("personal-");
}

/** Dono do projeto pessoal derivado do id (`personal-<userId>`). */
export function personalProjectOwner(id: string): string {
  return id.slice("personal-".length);
}

/** Retorna o id do projeto pessoal do usuário, criando (ou restaurando) se preciso. */
export async function ensurePersonalProject(userId: string): Promise<string> {
  const id = personalProjectId(userId);
  const { data: existing } = await supabase
    .from("projects")
    .select("id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (existing) {
    if (existing.deleted_at) {
      await supabase.from("projects").update({ deleted_at: null }).eq("id", id);
    }
    return id;
  }

  await supabase.from("projects").insert({
    id,
    name: "Pessoal",
    color: PERSONAL_COLOR,
    icon: "",
    owner_id: userId,
    workspace_id: null,
  });
  return id;
}
