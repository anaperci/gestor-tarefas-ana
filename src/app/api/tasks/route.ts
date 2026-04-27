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
  assignedTo: idSchema.optional(),
  link: linkSchema.optional().or(z.literal("").optional()),
});

async function userCanAccessProject(user: AuthUser, projectId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const { data: proj } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!proj) return false;
  if (proj.owner_id === user.id) return true;

  const { data: share } = await supabase
    .from("project_shares")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (share) return true;

  const { data: assigned } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", projectId)
    .eq("assigned_to", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return !!assigned;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  let tasks: TaskRow[];
  if (user.role === "admin") {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    tasks = (data ?? []) as TaskRow[];
  } else {
    // RPC já filtra deleted_at desde a sprint-1 SQL migration
    const { data } = await supabase.rpc("get_user_tasks", { p_user_id: user.id });
    tasks = (data ?? []) as TaskRow[];
  }

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
    description: body.description ?? "",
    status: body.status ?? "todo",
    priority: body.priority ?? "medium",
    deadline: body.deadline ?? "",
    start_date: body.startDate ?? "",
    estimate_hours: body.estimateHours ?? null,
    tag_ids: body.tagIds ?? [],
    project_id: body.projectId,
    assigned_to: finalAssignee,
    created_by: user.id,
    link: body.link ?? "",
    checked: false,
  });

  if (error) {
    console.error("[tasks.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar tarefa");
  }

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).single();
  const enriched = await enrichTask(task as TaskRow);
  return NextResponse.json(enriched, { status: 201 });
});
