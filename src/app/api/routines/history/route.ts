import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-error";

const daysQuerySchema = z.coerce.number().int().min(1).max(365).default(7);

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const url = new URL(request.url);
  const days = daysQuerySchema.parse(url.searchParams.get("days") ?? undefined);

  const { count: totalItems } = await supabase
    .from("routine_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startDateStr = startDate.toLocaleDateString("en-CA");

  const { data: checks } = await supabase
    .from("routine_checks")
    .select("check_date")
    .eq("user_id", user.id)
    .gte("check_date", startDateStr);

  const history = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toLocaleDateString("en-CA");
    const completed = (checks ?? []).filter((c) => c.check_date === dateStr).length;
    history.push({ date: dateStr, completed, total: totalItems ?? 0 });
  }

  return NextResponse.json({ history });
});
