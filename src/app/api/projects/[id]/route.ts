import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";

const patchSchema = z.object({
  workspaceId: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(120).optional(),
});

export const PATCH = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user); // mover/renomear projeto é ação de admin

    const body = await parseJson(request, patchSchema);

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!project) throw new ApiError("NOT_FOUND", "Projeto não encontrado");

    const updates: Record<string, unknown> = {};

    if (body.workspaceId) {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .eq("id", body.workspaceId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!ws) throw new ApiError("NOT_FOUND", "Workspace não encontrado");
      updates.workspace_id = body.workspaceId;
    }
    if (body.name) updates.name = body.name.trim();

    if (Object.keys(updates).length === 0) {
      throw new ApiError("VALIDATION_ERROR", "Nada para atualizar");
    }

    const { error } = await supabase.from("projects").update(updates).eq("id", id);
    if (error) {
      console.error("[projects.PATCH] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar projeto");
    }

    await audit({
      action: "project.move",
      resource: "projects",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: updates,
      request,
    });

    return NextResponse.json({ success: true, ...updates });
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!project) throw new ApiError("NOT_FOUND", "Projeto não encontrado");
    if (project.owner_id !== user.id) {
      throw new ApiError("FORBIDDEN", "Só o dono do projeto pode removê-lo");
    }

    const now = new Date().toISOString();

    // Soft delete em cascata: projeto + suas tasks
    // (subtasks/checklist permanecem ligados às tasks via FK; ocultos
    // automaticamente porque a task está soft-deleted)
    const { error: projErr } = await supabase
      .from("projects")
      .update({ deleted_at: now })
      .eq("id", id);

    if (projErr) {
      console.error("[projects.DELETE] project update failed:", projErr);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover projeto");
    }

    const { error: tasksErr } = await supabase
      .from("tasks")
      .update({ deleted_at: now })
      .eq("project_id", id)
      .is("deleted_at", null);

    if (tasksErr) {
      console.error("[projects.DELETE] tasks cascade failed:", tasksErr);
      // Projeto já está soft-deleted; tasks órfãs podem ser limpas depois
    }

    await audit({
      action: "project.delete",
      resource: "projects",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      request,
    });

    return NextResponse.json({ success: true });
  }
);
