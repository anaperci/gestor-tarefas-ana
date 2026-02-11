import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { genId } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { data: item } = await supabase
    .from("routine_items")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }
  if (item.user_id !== authResult.user!.id) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
  }

  let body: { date?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  const checkDate = body.date || new Date().toLocaleDateString("en-CA");

  // Check if already checked today
  const { data: existing } = await supabase
    .from("routine_checks")
    .select("id")
    .eq("routine_item_id", id)
    .eq("check_date", checkDate)
    .single();

  if (existing) {
    // Uncheck: delete the record
    await supabase.from("routine_checks").delete().eq("id", existing.id);
    return NextResponse.json({ checked: false, date: checkDate });
  } else {
    // Check: insert new record
    await supabase.from("routine_checks").insert({
      id: "rcheck-" + genId(),
      routine_item_id: id,
      user_id: authResult.user!.id,
      check_date: checkDate,
    });
    return NextResponse.json({ checked: true, date: checkDate });
  }
}
