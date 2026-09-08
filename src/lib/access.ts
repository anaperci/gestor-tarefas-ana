import { supabase } from "./supabase";
import type { AuthUser } from "./auth";
import { ApiError } from "./api-error";

export async function userCanAccessProject(user: Pick<AuthUser, "id" | "role">, projectId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_access_project", { p_user_id: user.id, p_project_id: projectId });
  if (error) throw new ApiError("INTERNAL_ERROR", "Não foi possível verificar o acesso.");
  return data === true;
}

export async function assertContentItemAccess(user: Pick<AuthUser, "id" | "role">, id: string): Promise<void> {
  const { data: item } = await supabase.from("content_items").select("workspace_id, created_by").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!item) throw new ApiError("NOT_FOUND", "Conteúdo não encontrado");
  if (!item.workspace_id) {
    if (item.created_by !== user.id) throw new ApiError("FORBIDDEN", "Conteúdo pessoal de outro usuário.");
    return;
  }
  await assertWorkspaceAccess(user, item.workspace_id);
}

export async function assertWorkspaceAccess(user: Pick<AuthUser, "id" | "role">, id: string): Promise<void> {
  const { data: ws } = await supabase.from("workspaces").select("owner_id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!ws) throw new ApiError("NOT_FOUND", "Workspace não encontrado");
  if (user.role === "admin" || ws.owner_id === user.id) return;
  const { data } = await supabase.from("workspace_members").select("user_id").eq("workspace_id", id).eq("user_id", user.id).maybeSingle();
  if (!data) throw new ApiError("FORBIDDEN", "Sem acesso a este workspace.");
}

export async function assertSlideAccess(user: Pick<AuthUser, "id" | "role">, id: string): Promise<string> {
  const { data } = await supabase.from("content_slides").select("content_item_id").eq("id", id).maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND", "Slide não encontrado");
  await assertContentItemAccess(user, data.content_item_id);
  return data.content_item_id;
}
