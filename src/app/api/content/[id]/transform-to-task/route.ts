import { assertContentItemAccess, userCanAccessProject } from "@/lib/access";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess, assertEditorOrAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
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
    assertEditorOrAdmin(user);
    await assertContentItemAccess(user, id);

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
      if (existing && await userCanAccessProject(user, content.linkedProjectId!)) {
        return NextResponse.json({ taskId: existing.id, alreadyLinked: true });
      }
    }

    const { projectId: bodyProjectId } = await parseJson(request, bodySchema);
    const projectId = bodyProjectId ?? content.linkedProjectId;
    if (!projectId) {
      throw new ApiError("VALIDATION_ERROR", "Vincule a um projeto ou envie projectId");
    }

    if (!(await userCanAccessProject(user, projectId))) throw new ApiError("FORBIDDEN", "Sem acesso ao projeto de destino");
    if (content.assignedTo) {
      const { data: assignee } = await supabase.from("users").select("id, role").eq("id", content.assignedTo).is("deleted_at", null).maybeSingle();
      if (!assignee || !(await userCanAccessProject(assignee, projectId))) throw new ApiError("VALIDATION_ERROR", "Responsável sem acesso ao destino");
    }
    const { data } = await supabase.rpc("transform_content_task", { p_content_id: id, p_project_id: projectId, p_user_id: user.id });
    return NextResponse.json(data, { status: data.alreadyLinked ? 200 : 201 });
  }
);
