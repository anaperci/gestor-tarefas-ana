import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { deadlineSchema, taskPrioritySchema, titleSchema } from "@/lib/validation";
import { ensurePersonalProject } from "@/lib/personal";

const createSchema = z.object({
  title: titleSchema,
  deadline: deadlineSchema.optional(),
  priority: taskPrioritySchema.optional(),
});

interface PersonalTaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  checked: boolean;
  created_at: string;
}

function toPersonalTask(r: PersonalTaskRow) {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    deadline: r.deadline ?? "",
    checked: !!r.checked,
    createdAt: r.created_at,
  };
}

// Lista as pendências pessoais do usuário (do projeto "Pessoal").
export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const projectId = await ensurePersonalProject(user.id);

  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, priority, deadline, checked, created_at")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("checked", { ascending: true })
    .order("created_at", { ascending: false });

  return NextResponse.json((data ?? []).map((r) => toPersonalTask(r as PersonalTaskRow)));
});

// Cria uma pendência pessoal (atribuída ao próprio usuário).
export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const { title, deadline, priority } = await parseJson(request, createSchema);
  const projectId = await ensurePersonalProject(user.id);

  const id = "task-" + genId();
  const { error } = await supabase.from("tasks").insert({
    id,
    title,
    description: "",
    status: "todo",
    priority: priority ?? "medium",
    deadline: deadline ?? "",
    project_id: projectId,
    assigned_to: user.id,
    created_by: user.id,
    checked: false,
  });

  if (error) {
    console.error("[personal.tasks.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar tarefa pessoal");
  }

  const { data: row } = await supabase
    .from("tasks")
    .select("id, title, status, priority, deadline, checked, created_at")
    .eq("id", id)
    .single();

  return NextResponse.json(toPersonalTask(row as PersonalTaskRow), { status: 201 });
});
