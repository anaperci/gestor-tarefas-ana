import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { summarizeTranscript, isOpenAIConfigured } from "@/lib/openai";

export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    if (!isOpenAIConfigured()) {
      throw new ApiError("INTERNAL_ERROR", "IA não configurada (falta OPENAI_API_KEY no servidor).");
    }

    const { data: t } = await supabase
      .from("meeting_transcriptions")
      .select("content")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!t) throw new ApiError("NOT_FOUND", "Transcrição não encontrada");

    const summary = await summarizeTranscript(t.content);

    const { error } = await supabase
      .from("meeting_transcriptions")
      .update({ summary })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new ApiError("INTERNAL_ERROR", "Falha ao salvar resumo");

    return NextResponse.json({ summary });
  }
);
