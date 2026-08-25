import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { userCanAccessProject } from "@/lib/access";
import { notificarTarefaCriada } from "@/lib/slack";

/**
 * POST — reenvia a notificação da tarefa para o canal do grupo.
 * Serve para tarefas que já existiam antes do canal ser configurado.
 */
export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertEditorOrAdmin(user);

    const { data: task } = await supabase
      .from("tasks")
      .select("id, title, priority, deadline, project_id, assigned_to")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");

    if (!(await userCanAccessProject(user, task.project_id))) {
      throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");
    }

    await notificarTarefaCriada({
      id: task.id,
      title: task.title,
      priority: task.priority,
      deadline: task.deadline ?? "",
      projectId: task.project_id,
      assignedTo: task.assigned_to,
      autorNome: user.name || user.username,
    });

    return NextResponse.json({ success: true });
  }
);
