import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";

interface TranscriptionRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  summary: string | null;
  created_at: string;
}

function rowTo(r: TranscriptionRow) {
  return { id: r.id, title: r.title, content: r.content, summary: r.summary, createdAt: r.created_at };
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(200000),
});

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const { data } = await supabase
    .from("meeting_transcriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json((data ?? []).map((r) => rowTo(r as TranscriptionRow)));
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const { title, content } = await parseJson(request, createSchema);

  const id = "trn-" + genId();
  const { error } = await supabase.from("meeting_transcriptions").insert({
    id, user_id: user.id, title: title.trim(), content,
  });
  if (error) {
    console.error("[transcriptions.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao salvar transcrição");
  }
  const { data } = await supabase.from("meeting_transcriptions").select("*").eq("id", id).single();
  return NextResponse.json(rowTo(data as TranscriptionRow), { status: 201 });
});
