import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { genId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const userId = authResult.user!.id;
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || new Date().toLocaleDateString("en-CA");

  const [{ data: items }, { data: checks }] = await Promise.all([
    supabase
      .from("routine_items")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("routine_checks")
      .select("*")
      .eq("user_id", userId)
      .eq("check_date", date),
  ]);

  return NextResponse.json({
    items: (items || []).map((i) => ({ ...i, active: !!i.active, userId: i.user_id, createdAt: i.created_at })),
    checks: (checks || []).map((c) => ({ ...c, routineItemId: c.routine_item_id, userId: c.user_id, checkDate: c.check_date, checkedAt: c.checked_at })),
    date,
  });
}

export async function POST(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { title } = await request.json();
  if (!title) {
    return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });
  }

  const userId = authResult.user!.id;

  // Get current count for sort_order
  const { count } = await supabase
    .from("routine_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("active", true);

  const id = "routine-" + genId();
  const { error } = await supabase.from("routine_items").insert({
    id,
    user_id: userId,
    title,
    sort_order: count || 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: item } = await supabase
    .from("routine_items")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json(
    { ...item, active: !!item!.active, userId: item!.user_id, createdAt: item!.created_at },
    { status: 201 }
  );
}
