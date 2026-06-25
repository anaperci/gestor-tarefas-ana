import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";

const mentionSchema = z.object({ userId: z.string().min(1) });

export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const actor = await requireAuth(request);
    const { userId } = await parseJson(request, mentionSchema);

    // Não notifica a si mesmo
    if (userId === actor.id) return NextResponse.json({ success: true, skipped: "self" });

    // Tarefa precisa existir (pega título p/ o texto da notificação)
    const { data: task } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");

    // Destinatário precisa existir e estar ativo
    const { data: target } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!target) throw new ApiError("VALIDATION_ERROR", "Usuário mencionado inválido");

    const actorName = actor.name || actor.username || "Alguém";
    const taskTitle = task.title || "uma tarefa";

    const { error } = await supabase.from("notifications").insert({
      id: "ntf-" + genId(),
      user_id: userId,
      actor_id: actor.id,
      type: "mention",
      task_id: id,
      title: `${actorName} mencionou você em "${taskTitle}"`,
    });
    if (error) {
      console.error("[tasks.mention.POST] insert failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao notificar");
    }

    return NextResponse.json({ success: true });
  }
);
