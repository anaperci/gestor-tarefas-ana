import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate, requireEditorOrAdmin } from "@/lib/auth";
import { genId } from "@/lib/utils";

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
    checklist: (checklist || []).map((c) => ({ ...c, done: !!c.done })),
    subtasks: (subtasks || []).map((s) => ({ ...s, checked: !!s.checked })),
    projectId: task.project_id,
    assignedTo: task.assigned_to,
    createdBy: task.created_by,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;

  let tasks: TaskRow[];
  if (user.role === "admin") {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    tasks = (data || []) as TaskRow[];
  } else {
    const { data } = await supabase.rpc("get_user_tasks", { p_user_id: user.id });
    tasks = (data || []) as TaskRow[];
  }

  const enriched = await Promise.all(tasks.map(enrichTask));
  return NextResponse.json(enriched);
}

async function canAccessProject(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === "admin") return true;
  const { data: proj } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .single();
  if (!proj) return false;
  if (proj.owner_id === userId) return true;
  const { data: share } = await supabase
    .from("project_shares")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .single();
  return !!share;
}

export async function POST(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const roleCheck = requireEditorOrAdmin(authResult.user!);
  if (roleCheck) return roleCheck;

  const { title, description, status, priority, deadline, projectId, assignedTo, link } =
    await request.json();

  if (!title || !projectId) {
    return NextResponse.json({ error: "Título e projeto obrigatórios" }, { status: 400 });
  }

  const hasAccess = await canAccessProject(authResult.user!.id, authResult.user!.role, projectId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const id = "task-" + genId();
  const { error } = await supabase.from("tasks").insert({
    id,
    title,
    description: description || "",
    status: status || "todo",
    priority: priority || "medium",
    deadline: deadline || "",
    project_id: projectId,
    assigned_to: assignedTo || authResult.user!.id,
    created_by: authResult.user!.id,
    link: link || "",
    checked: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  const enriched = await enrichTask(task as TaskRow);
  return NextResponse.json(enriched, { status: 201 });
}
