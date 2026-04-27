import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";

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

    return NextResponse.json({ success: true });
  }
);
