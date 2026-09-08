import { visibleProjectRows } from "@/lib/collections";
import { todayDate } from "@/lib/dates";
import { consumeRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { transcribeAudio, structureVoiceNote, isOpenAIConfigured } from "@/lib/openai";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (limite do Whisper)

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  await consumeRateLimit(user.id, { key: "ai", limit: 20, windowMs: 3600_000 });

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
  const projects = await visibleProjectRows(user.id);

  // 3. Estruturar em tarefas + notas
  const todayISO = todayDate();
  const structured = await structureVoiceNote(transcription, projects, todayISO);

  return NextResponse.json({ transcription, ...structured });
});
