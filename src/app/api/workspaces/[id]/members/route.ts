import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertCanManageWorkspace } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { idSchema, MAX_WORKSPACE_MEMBERS } from "@/lib/validation";

const membersSchema = z.object({
  members: z.array(idSchema).max(MAX_WORKSPACE_MEMBERS),
});

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!ws) throw new ApiError("NOT_FOUND", "Workspace não encontrado");
    assertCanManageWorkspace(user, ws.owner_id);

    const { members } = await parseJson(request, membersSchema);

    // O dono (gestor) é sempre membro
    const finalMembers = Array.from(new Set([...members, ws.owner_id]));

    // Valida usuários existentes e ativos
    if (finalMembers.length > 0) {
      const { data: validUsers } = await supabase
        .from("users")
        .select("id")
        .in("id", finalMembers)
        .is("deleted_at", null);
      const validIds = new Set((validUsers ?? []).map((u) => u.id));
      const invalid = finalMembers.filter((uid) => !validIds.has(uid));
      if (invalid.length > 0) {
        throw new ApiError("VALIDATION_ERROR", "Usuário(s) inválido(s)", { invalid });
      }
    }

    await supabase.from("workspace_members").delete().eq("workspace_id", id);

    if (finalMembers.length > 0) {
      const { error } = await supabase
        .from("workspace_members")
        .insert(finalMembers.map((userId) => ({ workspace_id: id, user_id: userId })));
      if (error) {
        console.error("[workspaces.members.PUT] insert failed:", error);
        throw new ApiError("INTERNAL_ERROR", "Falha ao salvar membros");
      }
    }

    await audit({
      action: "workspace.members",
      resource: "workspaces",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: { members: finalMembers },
      request,
    });

    return NextResponse.json({ success: true, members: finalMembers });
  }
);
