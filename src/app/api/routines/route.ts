import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { titleSchema } from "@/lib/validation";

const daysSchema = z.array(z.number().int().min(0).max(6)).max(7);
const createRoutineSchema = z.object({ title: titleSchema, days: daysSchema.optional() });

/** Normaliza os dias: remove duplicados, ordena; vazio vira a semana toda. */
function normalizeDays(days?: number[]): number[] {
  const set = Array.from(new Set(days ?? [])).sort((a, b) => a - b);
  return set.length ? set : [0, 1, 2, 3, 4, 5, 6];
}

const dateQuerySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const url = new URL(request.url);
  const dateParam = dateQuerySchema.parse(url.searchParams.get("date") ?? undefined);
  const date = dateParam ?? new Date().toLocaleDateString("en-CA");

  const [{ data: items }, { data: checks }] = await Promise.all([
    supabase
      .from("routine_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("routine_checks")
      .select("*")
      .eq("user_id", user.id)
      .eq("check_date", date),
  ]);

  return NextResponse.json({
    items: (items ?? []).map((i) => ({
      ...i,
      active: !!i.active,
      userId: i.user_id,
      days: i.days ?? [0, 1, 2, 3, 4, 5, 6],
      createdAt: i.created_at,
    })),
    checks: (checks ?? []).map((c) => ({
      ...c,
      routineItemId: c.routine_item_id,
      userId: c.user_id,
      checkDate: c.check_date,
      checkedAt: c.checked_at,
    })),
    date,
  });
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const { title, days } = await parseJson(request, createRoutineSchema);

  const { count } = await supabase
    .from("routine_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  const id = "routine-" + genId();
  const { error } = await supabase.from("routine_items").insert({
    id,
    user_id: user.id,
    title,
    sort_order: count ?? 0,
    days: normalizeDays(days),
  });

  if (error) {
    console.error("[routines.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar item de rotina");
  }

  const { data: item } = await supabase.from("routine_items").select("*").eq("id", id).single();
  return NextResponse.json(
    { ...item, active: !!item!.active, userId: item!.user_id, days: item!.days ?? [0, 1, 2, 3, 4, 5, 6], createdAt: item!.created_at },
    { status: 201 }
  );
});
