import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { longTextSchema, titleSchema } from "@/lib/validation";

const createNoteSchema = z.object({
  title: titleSchema.optional(),
  content: longTextSchema.optional(),
});

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  return NextResponse.json(
    (data ?? []).map((n) => ({
      ...n,
      pinned: !!n.pinned,
      userId: n.user_id,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }))
  );
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const { title, content } = await parseJson(request, createNoteSchema);

  const id = "note-" + genId();
  const { error } = await supabase.from("notes").insert({
    id,
    user_id: user.id,
    title: title?.trim() || "Sem título",
    content: content || "",
  });

  if (error) {
    console.error("[notes.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar nota");
  }

  const { data: note } = await supabase.from("notes").select("*").eq("id", id).single();
  return NextResponse.json(
    { ...note, pinned: !!note!.pinned, userId: note!.user_id, createdAt: note!.created_at, updatedAt: note!.updated_at },
    { status: 201 }
  );
});
