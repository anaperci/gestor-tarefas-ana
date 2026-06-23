import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertCanManageWorkspace } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { colorSchema, emojiSchema, titleSchema } from "@/lib/validation";

const updateWorkspaceSchema = z.object({
  name: titleSchema.optional(),
  color: colorSchema.optional(),
  icon: emojiSchema.optional(),
});

async function loadWorkspace(id: string) {
  const { data } = await supabase
    .from("workspaces")
    .select("id, owner_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND", "Workspace não encontrado");
  return data as { id: string; owner_id: string };
}

export const PATCH = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    const ws = await loadWorkspace(id);
    assertCanManageWorkspace(user, ws.owner_id);

    const patch = await parseJson(request, updateWorkspaceSchema);
    if (Object.keys(patch).length === 0) {
      throw new ApiError("VALIDATION_ERROR", "Nada para atualizar");
    }

    const { error } = await supabase.from("workspaces").update(patch).eq("id", id);
    if (error) {
      console.error("[workspaces.PATCH] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar workspace");
    }

    await audit({
      action: "workspace.update",
      resource: "workspaces",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: patch,
      request,
    });

    return NextResponse.json({ success: true });
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    const ws = await loadWorkspace(id);
    assertCanManageWorkspace(user, ws.owner_id);

    // Não deixa apagar workspace que ainda tem projetos — evita projeto órfão
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", id)
      .is("deleted_at", null);
    if ((count ?? 0) > 0) {
      throw new ApiError("CONFLICT", "Mova ou remova os projetos antes de apagar o workspace.");
    }

    const { error } = await supabase
      .from("workspaces")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[workspaces.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover workspace");
    }

    await audit({
      action: "workspace.delete",
      resource: "workspaces",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      request,
    });

    return NextResponse.json({ success: true });
  }
);
