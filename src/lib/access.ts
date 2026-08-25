import { supabase } from "./supabase";
import type { AuthUser } from "./auth";

/**
 * Quem pode mexer num projeto. Espelha a regra do RPC get_user_projects,
 * que decide o que cada um ENXERGA — antes as duas divergiam: o editor via
 * o projeto na tela mas era recusado como responsável de tarefa nele.
 *
 * Vale para: admin, dono do projeto, quem está nos shares, quem tem tarefa
 * atribuída ali, ou membro do workspace (respeitando os shares, quando o
 * projeto tiver algum).
 */
export async function userCanAccessProject(
  user: Pick<AuthUser, "id" | "role">,
  projectId: string
): Promise<boolean> {
  if (user.role === "admin") return true;

  const { data: proj } = await supabase
    .from("projects")
    .select("owner_id, workspace_id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!proj) return false;
  if (proj.owner_id === user.id) return true;

  const { data: share } = await supabase
    .from("project_shares")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (share) return true;

  const { data: assigned } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", projectId)
    .eq("assigned_to", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (assigned) return true;

  // Membro do workspace: vale se o projeto não restringe por share.
  if (proj.workspace_id) {
    const { data: member } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", proj.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (member) {
      const { count } = await supabase
        .from("project_shares")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId);
      if (!count) return true;
    }
  }

  return false;
}
