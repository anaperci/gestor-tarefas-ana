import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { transcribeAudio, structureVoiceNote, isOpenAIConfigured } from "@/lib/openai";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (limite do Whisper)

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  if (!isOpenAIConfigured()) {
    throw new ApiError("INTERNAL_ERROR", "IA não configurada (falta OPENAI_API_KEY no servidor).");
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", "Áudio ausente");
  if (file.size === 0) throw new ApiError("VALIDATION_ERROR", "Áudio vazio");
  if (file.size > MAX_BYTES) throw new ApiError("VALIDATION_ERROR", "Áudio acima de 25 MB");

  // 1. Transcrever
  const transcription = await transcribeAudio(file);
  if (!transcription) {
    return NextResponse.json({ transcription: "", tasks: [], notes: [] });
  }

  // 2. Projetos disponíveis (p/ a IA sugerir projectId)
  let projects: { id: string; name: string }[] = [];
  if (user.role === "admin") {
    const { data } = await supabase.from("projects").select("id, name").is("deleted_at", null);
    projects = (data ?? []) as { id: string; name: string }[];
  } else {
    const { data } = await supabase.rpc("get_user_projects", { p_user_id: user.id });
    projects = (data ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
  }

  // 3. Estruturar em tarefas + notas
  const todayISO = new Date().toISOString().slice(0, 10);
  const structured = await structureVoiceNote(transcription, projects, todayISO);

  return NextResponse.json({ transcription, ...structured });
});
