import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const userId = authResult.user!.id;
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "7", 10);

  // Get total active routine items
  const { count: totalItems } = await supabase
    .from("routine_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("active", true);

  // Get checks for the last N days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startDateStr = startDate.toLocaleDateString("en-CA");

  const { data: checks } = await supabase
    .from("routine_checks")
    .select("check_date")
    .eq("user_id", userId)
    .gte("check_date", startDateStr);

  // Build history array
  const history = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toLocaleDateString("en-CA");
    const completed = (checks || []).filter((c) => c.check_date === dateStr).length;
    history.push({ date: dateStr, completed, total: totalItems || 0 });
  }

  return NextResponse.json({ history });
}
