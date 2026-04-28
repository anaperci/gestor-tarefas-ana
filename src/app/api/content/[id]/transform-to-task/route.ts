import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { idSchema } from "@/lib/validation";
import { rowToItem, type ContentRow } from "@/lib/content";

const bodySchema = z.object({
  projectId: idSchema.optional(),
});

/**
 * Cria uma tarefa no projeto vinculado (ou no projeto enviado), copia
 * title + body do conteúdo, e atualiza linked_task_id no content_item.
 */
export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { data: contentRow } = await supabase
      .from("content_items")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!contentRow) throw new ApiError("NOT_FOUND", "Conteúdo não encontrado");
    const content = rowToItem(contentRow as ContentRow);

    // Se já vinculado, retorna o existente
    if (content.linkedTaskId) {
      const { data: existing } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("id", content.linkedTaskId)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ taskId: existing.id, alreadyLinked: true });
      }
    }

    const { projectId: bodyProjectId } = await parseJson(request, bodySchema);
    const projectId = bodyProjectId ?? content.linkedProjectId;
    if (!projectId) {
      throw new ApiError("VALIDATION_ERROR", "Vincule a um projeto ou envie projectId");
    }

    const taskTitle = content.title.trim() || (content.body.replace(/\s+/g, " ").slice(0, 80) || "Nova tarefa");
    const taskId = "task-" + genId();

    const { error: taskErr } = await supabase.from("tasks").insert({
      id: taskId,
      title: taskTitle,
      description: content.body || "",
      status: "todo",
      priority: "medium",
      deadline: "",
      project_id: projectId,
      assigned_to: content.assignedTo ?? user.id,
      created_by: user.id,
      link: "",
      checked: false,
    });

    if (taskErr) {
      console.error("[content.transform-to-task] failed:", taskErr);
      throw new ApiError("INTERNAL_ERROR", "Falha ao criar tarefa");
    }

    await supabase.from("content_items").update({
      linked_task_id: taskId,
      linked_project_id: projectId,
      updated_at: new Date().toISOString(),
      last_edited_by: user.id,
    }).eq("id", id);

    return NextResponse.json({ taskId, alreadyLinked: false }, { status: 201 });
  }
);
