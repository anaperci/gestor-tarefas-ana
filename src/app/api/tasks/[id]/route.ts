import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin, AuthUser } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { genId } from "@/lib/utils";
import {
  checklistItemSchema,
  deadlineSchema,
  idSchema,
  linkSchema,
  longTextSchema,
  MAX_CHECKLIST_ITEMS,
  MAX_SUBTASKS,
  subtaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
  titleSchema,
} from "@/lib/validation";
import { enrichTask, TaskRow } from "@/lib/tasks";
import { userCanAccessProject } from "@/lib/access";

const updateTaskSchema = z.object({
  title: titleSchema.optional(),
  description: longTextSchema.optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  deadline: deadlineSchema.optional(),
  startDate: deadlineSchema.optional(),
  estimateHours: z.number().min(0).max(9999).nullable().optional(),
  tagIds: z.array(idSchema).max(20).optional(),
  projectId: idSchema.optional(),
  groupId: idSchema.nullable().optional(),
  assignedTo: idSchema.nullable().optional(),
  link: linkSchema.optional().or(z.literal("").optional()),
  checked: z.boolean().optional(),
  checklist: z.array(checklistItemSchema).max(MAX_CHECKLIST_ITEMS).optional(),
  subtasks: z.array(subtaskSchema).max(MAX_SUBTASKS).optional(),
});


export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertEditorOrAdmin(user);

    const { data: task } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");

    const hasAccess = await userCanAccessProject(user, task.project_id);
    if (!hasAccess) throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");

    const body = await parseJson(request, updateTaskSchema);

    const targetProjectId = body.projectId ?? task.project_id;

    if (body.projectId && body.projectId !== task.project_id) {
      const okNewProject = await userCanAccessProject(user, body.projectId);
      if (!okNewProject) {
        throw new ApiError("FORBIDDEN", "Sem acesso ao projeto de destino");
      }
    }

    // Grupo: precisa pertencer ao projeto de destino. Se a tarefa muda de
    // projeto sem grupo informado, ela sai do grupo antigo.
    let targetGroupId: string | null =
      body.groupId !== undefined ? body.groupId : (task.group_id ?? null);
    if (body.projectId && body.projectId !== task.project_id && body.groupId === undefined) {
      targetGroupId = null;
    }
    if (targetGroupId) {
      const { data: group } = await supabase
        .from("task_groups")
        .select("id, project_id")
        .eq("id", targetGroupId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!group || group.project_id !== targetProjectId) {
        throw new ApiError("VALIDATION_ERROR", "Grupo inválido para este projeto");
      }
    }

    if (body.assignedTo !== undefined && body.assignedTo !== null && body.assignedTo !== task.assigned_to) {
      const { data: assignee } = await supabase
        .from("users")
        .select("id, username, name, role, avatar")
        .eq("id", body.assignedTo)
        .is("deleted_at", null)
        .maybeSingle();
      if (!assignee) throw new ApiError("VALIDATION_ERROR", "Responsável inválido");
      const assigneeCanAccess = await userCanAccessProject(assignee as AuthUser, targetProjectId);
      if (!assigneeCanAccess) {
        throw new ApiError("VALIDATION_ERROR", "Responsável não tem acesso a este projeto");
      }
    }

    const { error: updErr } = await supabase
      .from("tasks")
      .update({
        title: body.title ?? task.title,
        description: body.description ?? task.description,
        status: body.status ?? task.status,
        priority: body.priority ?? task.priority,
        deadline: body.deadline ?? task.deadline,
        start_date: body.startDate ?? task.start_date,
        estimate_hours: body.estimateHours !== undefined ? body.estimateHours : task.estimate_hours,
        tag_ids: body.tagIds ?? task.tag_ids,
        project_id: targetProjectId,
        group_id: targetGroupId,
        assigned_to: body.assignedTo ?? task.assigned_to,
        link: body.link ?? task.link,
        checked: body.checked ?? task.checked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updErr) {
      console.error("[tasks.PUT] update failed:", updErr);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar tarefa");
    }

    if (Array.isArray(body.checklist)) {
      await supabase.from("checklist_items").delete().eq("task_id", id);
      if (body.checklist.length > 0) {
        await supabase.from("checklist_items").insert(
          body.checklist.map((item, i) => ({
            id: item.id || "cl-" + genId(),
            task_id: id,
            text: item.text,
            done: item.done ?? false,
            sort_order: i,
          }))
        );
      }
    }

    if (Array.isArray(body.subtasks)) {
      await supabase.from("subtasks").delete().eq("task_id", id);
      if (body.subtasks.length > 0) {
        await supabase.from("subtasks").insert(
          body.subtasks.map((st, i) => ({
            id: st.id || "st-" + genId(),
            task_id: id,
            title: st.title,
            status: st.status ?? "todo",
            checked: st.checked ?? false,
            sort_order: i,
          }))
        );
      }
    }

    const { data: updated } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    const enriched = await enrichTask(updated as TaskRow);
    return NextResponse.json(enriched);
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertEditorOrAdmin(user);

    const { data: task } = await supabase
      .from("tasks")
      .select("project_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");

    const hasAccess = await userCanAccessProject(user, task.project_id);
    if (!hasAccess) throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");

    // Soft delete: preserva auditoria e permite recovery
    const { error } = await supabase
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[tasks.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover tarefa");
    }

    await audit({
      action: "task.delete",
      resource: "tasks",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      request,
    });
    return NextResponse.json({ success: true });
  }
);
