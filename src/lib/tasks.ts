import { supabase } from "./supabase";

export interface TaskRow {
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

export interface ChecklistItemRow {
  id: string;
  text: string;
  done: boolean;
  task_id: string;
  sort_order: number;
}

export interface SubtaskRow {
  id: string;
  title: string;
  status: string;
  checked: boolean;
  task_id: string;
  sort_order: number;
}

export interface EnrichedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  link: string;
  checked: boolean;
  projectId: string;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  checklist: { id: string; text: string; done: boolean }[];
  subtasks: { id: string; title: string; status: string; checked: boolean }[];
}

function toEnriched(
  task: TaskRow,
  checklist: { id: string; text: string; done: boolean }[],
  subtasks: { id: string; title: string; status: string; checked: boolean }[]
): EnrichedTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline,
    link: task.link,
    checked: !!task.checked,
    projectId: task.project_id,
    assignedTo: task.assigned_to,
    createdBy: task.created_by,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    checklist,
    subtasks,
  };
}

/** Single task — 2 queries. Use enrichTasksBatch para listas. */
export async function enrichTask(task: TaskRow): Promise<EnrichedTask> {
  const [{ data: checklist }, { data: subtasks }] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("id, text, done")
      .eq("task_id", task.id)
      .order("sort_order"),
    supabase
      .from("subtasks")
      .select("id, title, status, checked")
      .eq("task_id", task.id)
      .order("sort_order"),
  ]);

  return toEnriched(
    task,
    (checklist ?? []).map((c) => ({ ...c, done: !!c.done })),
    (subtasks ?? []).map((s) => ({ ...s, checked: !!s.checked }))
  );
}

/**
 * FASE2.3b — N+1 killer.
 * Para N tasks faz exatamente 2 queries (checklist + subtasks de TODAS),
 * agrupa em memória por task_id e devolve a lista enriquecida.
 */
export async function enrichTasksBatch(tasks: TaskRow[]): Promise<EnrichedTask[]> {
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id);

  const [{ data: allChecklist }, { data: allSubtasks }] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("id, text, done, task_id, sort_order")
      .in("task_id", taskIds)
      .order("sort_order"),
    supabase
      .from("subtasks")
      .select("id, title, status, checked, task_id, sort_order")
      .in("task_id", taskIds)
      .order("sort_order"),
  ]);

  const checklistByTask = new Map<string, { id: string; text: string; done: boolean }[]>();
  for (const c of (allChecklist ?? []) as ChecklistItemRow[]) {
    const list = checklistByTask.get(c.task_id) ?? [];
    list.push({ id: c.id, text: c.text, done: !!c.done });
    checklistByTask.set(c.task_id, list);
  }

  const subtasksByTask = new Map<string, { id: string; title: string; status: string; checked: boolean }[]>();
  for (const s of (allSubtasks ?? []) as SubtaskRow[]) {
    const list = subtasksByTask.get(s.task_id) ?? [];
    list.push({ id: s.id, title: s.title, status: s.status, checked: !!s.checked });
    subtasksByTask.set(s.task_id, list);
  }

  return tasks.map((t) =>
    toEnriched(t, checklistByTask.get(t.id) ?? [], subtasksByTask.get(t.id) ?? [])
  );
}
