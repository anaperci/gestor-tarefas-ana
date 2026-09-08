import { visibleTaskRows } from "@/lib/collections";
import { safeHtml } from "@/lib/html";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin, AuthUser } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import {
  deadlineSchema,
  idSchema,
  linkSchema,
  longTextSchema,
  taskPrioritySchema,
  taskStatusSchema,
  titleSchema,
} from "@/lib/validation";
import { enrichTask, enrichTasksBatch, TaskRow } from "@/lib/tasks";
import { userCanAccessProject } from "@/lib/access";
import { notificarTarefaCriada } from "@/lib/slack";

const createTaskSchema = z.object({
  title: titleSchema,
  description: longTextSchema.optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  deadline: deadlineSchema.optional(),
  startDate: deadlineSchema.optional(),
  estimateHours: z.number().min(0).max(9999).nullable().optional(),
  tagIds: z.array(idSchema).max(20).optional(),
  projectId: idSchema,
  groupId: idSchema.nullable().optional(),
  assignedTo: idSchema.optional(),
  link: linkSchema.optional().or(z.literal("").optional()),
});


export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  const tasks = await visibleTaskRows(user.id);

  // FASE2.3b — eliminar N+1: 2 queries em batch (checklist + subtasks)
  // mesmo com 200 tasks, são apenas 3 queries totais
  const enriched = await enrichTasksBatch(tasks);
  return NextResponse.json(enriched);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertEditorOrAdmin(user);

  const body = await parseJson(request, createTaskSchema);

  const hasAccess = await userCanAccessProject(user, body.projectId);
  if (!hasAccess) throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");

  // Grupo precisa pertencer ao projeto informado.
  if (body.groupId) {
    const { data: group } = await supabase
      .from("task_groups")
      .select("id, project_id")
      .eq("id", body.groupId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!group || group.project_id !== body.projectId) {
      throw new ApiError("VALIDATION_ERROR", "Grupo inválido para este projeto");
    }
  }

  // FASE1.9 — assignedTo precisa ter acesso ao projeto
  const finalAssignee = body.assignedTo || user.id;
  if (finalAssignee !== user.id) {
    const { data: assignee } = await supabase
      .from("users")
      .select("id, username, name, role, avatar")
      .eq("id", finalAssignee)
      .is("deleted_at", null)
      .maybeSingle();
    if (!assignee) throw new ApiError("VALIDATION_ERROR", "Responsável inválido");
    const assigneeCanAccess = await userCanAccessProject(assignee as AuthUser, body.projectId);
    if (!assigneeCanAccess) {
      throw new ApiError("VALIDATION_ERROR", "Responsável não tem acesso a este projeto");
    }
  }

  const id = "task-" + genId();
  const { error } = await supabase.from("tasks").insert({
    id,
    title: body.title,
    description: safeHtml(body.description ?? ""),
    status: body.status ?? "todo",
    priority: body.priority ?? "medium",
    deadline: body.deadline ?? "",
    start_date: body.startDate ?? "",
    estimate_hours: body.estimateHours ?? null,
    tag_ids: body.tagIds ?? [],
    project_id: body.projectId,
    group_id: body.groupId ?? null,
    assigned_to: finalAssignee,
    created_by: user.id,
    link: body.link ?? "",
    checked: body.status === "done",
  });

  if (error) {
    console.error("[tasks.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar tarefa");
  }

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).single();
  const enriched = await enrichTask(task as TaskRow);

  // Slack: avisa o canal. Não bloqueia a resposta nem derruba a criação.
  void notificarTarefaCriada({
    id,
    title: body.title,
    priority: body.priority ?? "medium",
    deadline: body.deadline ?? "",
    projectId: body.projectId,
    assignedTo: finalAssignee,
    autorNome: user.name || user.username,
  });

  return NextResponse.json(enriched, { status: 201 });
});
