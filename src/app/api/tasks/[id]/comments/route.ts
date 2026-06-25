import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";

const commentSchema = z.object({ body: z.string().min(1).max(5000) });

interface TaskCommentRow {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

function rowToComment(r: TaskCommentRow) {
  return {
    id: r.id,
    taskId: r.task_id,
    userId: r.user_id,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function assertTaskExists(id: string) {
  const { data } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");
}

export const GET = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    await requireAuth(request);

    const { data } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json((data ?? []).map((r) => rowToComment(r as TaskCommentRow)));
  }
);

export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    await assertTaskExists(id);

    const { body } = await parseJson(request, commentSchema);

    const commentId = "tcmt-" + genId();
    const { error } = await supabase.from("task_comments").insert({
      id: commentId,
      task_id: id,
      user_id: user.id,
      body,
    });
    if (error) {
      console.error("[task.comments.POST] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao comentar");
    }

    const { data } = await supabase.from("task_comments").select("*").eq("id", commentId).single();
    return NextResponse.json(rowToComment(data as TaskCommentRow), { status: 201 });
  }
);
