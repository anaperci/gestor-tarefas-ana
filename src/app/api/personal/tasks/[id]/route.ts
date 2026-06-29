import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { personalProjectId } from "@/lib/personal";

const patchSchema = z.object({
  checked: z.boolean().optional(),
});

// Garante que a tarefa pertence ao projeto pessoal de quem chama.
async function loadOwnPersonalTask(userId: string, taskId: string) {
  const { data: task } = await supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task || task.project_id !== personalProjectId(userId)) {
    throw new ApiError("NOT_FOUND", "Tarefa não encontrada");
  }
  return task;
}

export const PATCH = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    await loadOwnPersonalTask(user.id, id);

    const body = await parseJson(request, patchSchema);
    if (body.checked !== undefined) {
      await supabase
        .from("tasks")
        .update({ checked: body.checked, status: body.checked ? "done" : "todo" })
        .eq("id", id);
    }
    return NextResponse.json({ success: true });
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    await loadOwnPersonalTask(user.id, id);

    await supabase
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ success: true });
  }
);
