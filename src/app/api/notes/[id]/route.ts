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

  const { data: note } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();

  if (!note) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }
  if (note.user_id !== authResult.user!.id) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
  }

  const body = await request.json();

  await supabase
    .from("notes")
    .update({
      title: body.title ?? note.title,
      content: body.content ?? note.content,
      pinned: body.pinned ?? note.pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  const { data: updated } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({
    ...updated,
    pinned: !!updated!.pinned,
    userId: updated!.user_id,
    createdAt: updated!.created_at,
    updatedAt: updated!.updated_at,
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

  const { data: note } = await supabase
    .from("notes")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!note) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }
  if (note.user_id !== authResult.user!.id) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
  }

  await supabase.from("notes").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
