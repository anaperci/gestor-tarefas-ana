import { safeHtml } from "@/lib/html";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin, AuthUser } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
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
  expectedUpdatedAt: z.string().datetime({offset:true}).optional(),
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

    const targetAssignee = body.assignedTo !== undefined ? body.assignedTo : task.assigned_to;
    if (targetAssignee && (targetAssignee !== task.assigned_to || targetProjectId !== task.project_id)) {
      const { data: assignee } = await supabase
        .from("users")
        .select("id, username, name, role, avatar")
        .eq("id", targetAssignee)
        .is("deleted_at", null)
        .maybeSingle();
      if (!assignee) throw new ApiError("VALIDATION_ERROR", "Responsável inválido");
      const assigneeCanAccess = await userCanAccessProject(assignee as AuthUser, targetProjectId);
      if (!assigneeCanAccess) {
        throw new ApiError("VALIDATION_ERROR", "Responsável não tem acesso a este projeto");
      }
    }

    const columns: Record<string, string> = { title:"title", description:"description", status:"status", priority:"priority", deadline:"deadline", startDate:"start_date", estimateHours:"estimate_hours", tagIds:"tag_ids", projectId:"project_id", groupId:"group_id", assignedTo:"assigned_to", link:"link", checked:"checked" };
    const patch: Record<string, unknown> = {};
    for (const [key,value] of Object.entries(body)) if (columns[key]) patch[columns[key]]=value;
    if (body.description !== undefined) patch.description=safeHtml(body.description);
    if (targetGroupId !== task.group_id) patch.group_id=targetGroupId;
    if (body.status !== undefined) patch.checked=body.status === "done";
    else if (body.checked !== undefined) patch.status=body.checked ? "done" : "todo";
    const { data: updated } = await supabase.rpc("save_task", {
      p_id: id, p_patch: patch, p_expected: body.expectedUpdatedAt ?? null,
      p_checklist: body.checklist ?? null, p_subtasks: body.subtasks ?? null,
    });

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
