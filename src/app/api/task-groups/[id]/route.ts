import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { colorSchema, titleSchema } from "@/lib/validation";
import { userCanAccessProject } from "@/lib/access";

const patchSchema = z.object({
  name: titleSchema.optional(),
  color: colorSchema.optional(),
});

async function loadGroup(id: string) {
  const { data } = await supabase
    .from("task_groups")
    .select("id, project_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND", "Grupo não encontrado");
  return data as { id: string; project_id: string };
}

export const PATCH = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertEditorOrAdmin(user);

    const group = await loadGroup(id);
    if (!(await userCanAccessProject(user, group.project_id))) {
      throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");
    }

    const body = await parseJson(request, patchSchema);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name) updates.name = body.name.trim();
    if (body.color) updates.color = body.color;
    if (Object.keys(updates).length === 1) {
      throw new ApiError("VALIDATION_ERROR", "Nada para atualizar");
    }

    const { error } = await supabase.from("task_groups").update(updates).eq("id", id);
    if (error) {
      console.error("[task-groups.PATCH] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar grupo");
    }

    await audit({
      action: "task_group.update",
      resource: "task_groups",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: updates,
      request,
    });

    return NextResponse.json({ success: true });
  }
);

/** Soft delete. As tarefas do grupo ficam sem grupo (caem em "Sem grupo"). */
export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertEditorOrAdmin(user);

    const group = await loadGroup(id);
    if (!(await userCanAccessProject(user, group.project_id))) {
      throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");
    }

    await supabase.rpc("delete_task_group", { p_id: id });

    await audit({
      action: "task_group.delete",
      resource: "task_groups",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      request,
    });

    return NextResponse.json({ success: true });
  }
);
