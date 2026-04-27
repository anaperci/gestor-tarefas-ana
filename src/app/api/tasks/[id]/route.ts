import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin, AuthUser } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
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

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  project_id: string;
  assigned_to: string | null;
  created_by: string;
  link: string;
  checked: boolean;
  created_at: string;
  updated_at: string;
}

const updateTaskSchema = z.object({
  title: titleSchema.optional(),
  description: longTextSchema.optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  deadline: deadlineSchema.optional(),
  projectId: idSchema.optional(),
  assignedTo: idSchema.nullable().optional(),
  link: linkSchema.optional().or(z.literal("").optional()),
  checked: z.boolean().optional(),
  checklist: z.array(checklistItemSchema).max(MAX_CHECKLIST_ITEMS).optional(),
  subtasks: z.array(subtaskSchema).max(MAX_SUBTASKS).optional(),
});

async function enrichTask(task: TaskRow) {
  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, text, done")
    .eq("task_id", task.id)
    .order("sort_order");

  const { data: subtasks } = await supabase
    .from("subtasks")
    .select("id, title, status, checked")
    .eq("task_id", task.id)
    .order("sort_order");

  return {
    ...task,
    checked: !!task.checked,
    checklist: (checklist ?? []).map((c) => ({ ...c, done: !!c.done })),
    subtasks: (subtasks ?? []).map((s) => ({ ...s, checked: !!s.checked })),
    projectId: task.project_id,
    assignedTo: task.assigned_to,
    createdBy: task.created_by,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

async function userCanAccessProject(user: AuthUser, projectId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const { data: proj } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!proj) return false;
  if (proj.owner_id === user.id) return true;

  const { data: share } = await supabase
    .from("project_shares")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  return !!share;
}

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertEditorOrAdmin(user);

    const { data: task } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");

    const hasAccess = await userCanAccessProject(user, task.project_id);
    if (!hasAccess) throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");

    const body = await parseJson(request, updateTaskSchema);

    const targetProjectId = body.projectId ?? task.project_id;

    // Se mudou projeto, valida acesso ao novo
    if (body.projectId && body.projectId !== task.project_id) {
      const okNewProject = await userCanAccessProject(user, body.projectId);
      if (!okNewProject) {
        throw new ApiError("FORBIDDEN", "Sem acesso ao projeto de destino");
      }
    }

    // FASE1.9 — assignedTo precisa ter acesso ao projeto-alvo
    if (body.assignedTo !== undefined && body.assignedTo !== null && body.assignedTo !== task.assigned_to) {
      const { data: assignee } = await supabase
        .from("users")
        .select("id, username, name, role, avatar")
        .eq("id", body.assignedTo)
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
        project_id: targetProjectId,
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
      .maybeSingle();
    if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");

    const hasAccess = await userCanAccessProject(user, task.project_id);
    if (!hasAccess) throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      console.error("[tasks.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover tarefa");
    }
    return NextResponse.json({ success: true });
  }
);
