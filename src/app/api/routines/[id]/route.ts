import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";

export async function PUT(
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
    .select("*")
    .eq("id", id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  }
  if (item.user_id !== authResult.user!.id) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
  }

  const body = await request.json();

  await supabase
    .from("routine_items")
    .update({
      title: body.title ?? item.title,
      sort_order: body.sort_order ?? item.sort_order,
      active: body.active ?? item.active,
    })
    .eq("id", id);

  const { data: updated } = await supabase
    .from("routine_items")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({
    ...updated,
    active: !!updated!.active,
    userId: updated!.user_id,
    createdAt: updated!.created_at,
  });
}

export async function DELETE(
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

  // Soft delete to preserve check history
  await supabase
    .from("routine_items")
    .update({ active: false })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
