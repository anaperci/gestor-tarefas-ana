import { supabase } from "./supabase";
import { ApiError } from "./api-error";
import type { TaskRow } from "./tasks";
export async function allRows<T>(page: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start=0;;start+=500) {
    const { data, error } = await page(start,start+499);
    if (error) throw new ApiError("INTERNAL_ERROR", "Falha ao carregar dados. Tente novamente.");
    rows.push(...(data ?? [])); if (!data || data.length<500) return rows;
  }
}
export function visibleTaskRows(userId: string): Promise<TaskRow[]> {
  return allRows<TaskRow>((a,b) => supabase.rpc("get_user_tasks", {p_user_id:userId}).range(a,b));
}
export interface ProjectRow { id:string; name:string; color:string; icon:string; owner_id:string; workspace_id:string|null; }
export function visibleProjectRows(userId: string): Promise<ProjectRow[]> {
  return allRows<ProjectRow>((a,b) => supabase.rpc("get_user_projects", {p_user_id:userId}).range(a,b));
}
