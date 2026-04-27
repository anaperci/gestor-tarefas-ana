import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-error";
import { enrichTasksBatch, TaskRow } from "@/lib/tasks";
import type {
  DashboardPayload,
  DashboardProjectSummary,
  DashboardRoutine,
  Note,
  Project,
  Role,
  RoutineItem,
  Task,
} from "@/lib/types";

function greetingPeriod(): "manhã" | "tarde" | "noite" {
  const h = new Date().getHours();
  if (h < 12) return "manhã";
  if (h < 18) return "tarde";
  return "noite";
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}

function isOverdue(t: Task): boolean {
  if (!t.deadline) return false;
  if (t.status === "done") return false;
  return t.deadline < todayStr();
}

function isToday(t: Task): boolean {
  return t.deadline === todayStr() || t.status === "doing";
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  const [
    tasksRes,
    projectsRes,
    sharesRes,
    notesRes,
    routinesRes,
    checksRes,
    weeklyRes,
  ] = await Promise.all([
    // tasks visíveis ao user (RPC já filtra deleted_at e visibilidade)
    user.role === "admin"
      ? supabase.from("tasks").select("*").is("deleted_at", null)
      : supabase.rpc("get_user_tasks", { p_user_id: user.id }),
    // projects visíveis
    user.role === "admin"
      ? supabase.from("projects").select("id, name, color, icon, owner_id").is("deleted_at", null)
      : supabase.rpc("get_user_projects", { p_user_id: user.id }),
    // todos os shares (pra mapear)
    supabase.from("project_shares").select("project_id, user_id"),
    // últimas 5 notas do user
    supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    // rotinas ativas do user
    supabase
      .from("routine_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order"),
    // checks de hoje
    supabase
      .from("routine_checks")
      .select("routine_item_id")
      .eq("user_id", user.id)
      .eq("check_date", todayStr()),
    // estatística semanal — tasks visíveis criadas/atualizadas nos últimos 7 dias
    user.role === "admin"
      ? supabase
          .from("tasks")
          .select("id, status, updated_at, deleted_at")
          .is("deleted_at", null)
          .gte("updated_at", new Date(Date.now() - 7 * 86400_000).toISOString())
      : supabase.rpc("get_user_tasks", { p_user_id: user.id }),
  ]);

  const allTasks = (tasksRes.data ?? []) as TaskRow[];
  const enriched = await enrichTasksBatch(allTasks);

  // Mapeia shares por projeto
  const sharesByProject = new Map<string, string[]>();
  for (const row of (sharesRes.data ?? []) as Array<{ project_id: string; user_id: string }>) {
    const list = sharesByProject.get(row.project_id) ?? [];
    list.push(row.user_id);
    sharesByProject.set(row.project_id, list);
  }

  const projectsRaw = (projectsRes.data ?? []) as Array<{
    id: string; name: string; color: string; icon: string; owner_id: string;
  }>;

  // Today: minhas atribuídas com deadline hoje OU status=doing
  const todayTasks = enriched
    .filter((t) => t.assignedTo === user.id && t.status !== "done" && isToday(t))
    .slice(0, 7);

  // Overdue: minhas (admin: minhas OR criei) atrasadas
  const overdueTasks = enriched
    .filter((t) => {
      if (!isOverdue(t)) return false;
      return t.assignedTo === user.id || (user.role === "admin" && t.createdBy === user.id);
    })
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1))
    .slice(0, 5);

  // Review: status=review (admin: criei OR sou owner do projeto; editor: criei)
  const reviewTasks = enriched
    .filter((t) => {
      if (t.status !== "review") return false;
      if (user.role === "admin") {
        const proj = projectsRaw.find((p) => p.id === t.projectId);
        return t.createdBy === user.id || proj?.owner_id === user.id;
      }
      if (user.role === "editor") return t.createdBy === user.id;
      return false;
    })
    .slice(0, 5);

  // Delegated: criei + atribuí pra alguém ≠ eu, não concluído
  const delegatedTasks = user.role === "viewer"
    ? []
    : enriched.filter(
        (t) => t.createdBy === user.id && t.assignedTo && t.assignedTo !== user.id && t.status !== "done"
      );

  // Active projects: até 6, ordenados por última atividade
  const projectStats = new Map<string, { open: number; done: number; total: number; last: string }>();
  for (const t of enriched) {
    const s = projectStats.get(t.projectId) ?? { open: 0, done: 0, total: 0, last: "" };
    s.total += 1;
    if (t.status === "done") s.done += 1; else s.open += 1;
    if (!s.last || t.updatedAt > s.last) s.last = t.updatedAt;
    projectStats.set(t.projectId, s);
  }
  const activeProjects: DashboardProjectSummary[] = projectsRaw
    .map((p) => {
      const s = projectStats.get(p.id) ?? { open: 0, done: 0, total: 0, last: "" };
      const proj: Project = {
        id: p.id,
        name: p.name,
        color: p.color,
        icon: p.icon,
        ownerId: p.owner_id,
        sharedWith: sharesByProject.get(p.id) ?? [],
      };
      return { ...proj, open_count: s.open, done_count: s.done, total_count: s.total, last_activity: s.last || null };
    })
    .sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""))
    .slice(0, 6);

  // Routines: items ativos + se foram checados hoje
  const checkedSet = new Set(
    ((checksRes.data ?? []) as Array<{ routine_item_id: string }>).map((c) => c.routine_item_id)
  );
  const todayRoutines: DashboardRoutine[] = ((routinesRes.data ?? []) as Array<RoutineItem & { user_id: string; sort_order: number }>).map((r) => ({
    id: r.id,
    title: r.title,
    sort_order: r.sort_order,
    active: r.active,
    userId: r.user_id ?? user.id,
    createdAt: r.createdAt ?? "",
    checked: checkedSet.has(r.id),
  }));

  // Weekly stats
  const weeklyData = (weeklyRes.data ?? []) as Array<{ status: string; updated_at?: string }>;
  const weeklyDone = weeklyData.filter((t) => t.status === "done").length;
  const weeklyTotal = weeklyData.length;

  const recentNotes: Note[] = ((notesRes.data ?? []) as Array<Note & { user_id: string; created_at: string; updated_at: string }>).map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    pinned: !!n.pinned,
    userId: n.user_id ?? user.id,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  const payload: DashboardPayload = {
    greeting: { name: user.name.split(" ")[0], period: greetingPeriod() },
    weekly_stats: { done: weeklyDone, total: weeklyTotal },
    today_tasks: todayTasks,
    overdue_tasks: overdueTasks,
    review_tasks: reviewTasks,
    delegated_tasks: delegatedTasks,
    active_projects: activeProjects,
    today_routines: todayRoutines,
    recent_notes: recentNotes,
    meta: { fetched_at: new Date().toISOString(), user_id: user.id, role: user.role as Role },
  };

  return NextResponse.json(payload);
});
