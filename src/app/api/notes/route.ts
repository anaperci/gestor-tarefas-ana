import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate } from "@/lib/auth";
import { genId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", authResult.user!.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  return NextResponse.json(
    (data || []).map((n) => ({
      ...n,
      pinned: !!n.pinned,
      userId: n.user_id,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }))
  );
}

export async function POST(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { title, content } = await request.json();

  const id = "note-" + genId();
  const { error } = await supabase.from("notes").insert({
    id,
    user_id: authResult.user!.id,
    title: title || "Sem título",
    content: content || "",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: note } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json(
    { ...note, pinned: !!note!.pinned, userId: note!.user_id, createdAt: note!.created_at, updatedAt: note!.updated_at },
    { status: 201 }
  );
}
