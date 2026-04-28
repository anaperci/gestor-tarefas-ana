import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { commentSchema } from "@/lib/content-schemas";

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ commentId: string }> }) => {
    const { commentId } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { data: existing } = await supabase
      .from("content_comments")
      .select("user_id")
      .eq("id", commentId)
      .maybeSingle();
    if (!existing) throw new ApiError("NOT_FOUND", "Comentário não encontrado");
    if (existing.user_id !== user.id) {
      throw new ApiError("FORBIDDEN", "Você só pode editar seus próprios comentários");
    }

    const { body } = await parseJson(request, commentSchema);
    const { error } = await supabase
      .from("content_comments")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", commentId);

    if (error) {
      console.error("[comments.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar comentário");
    }
    return NextResponse.json({ success: true });
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ commentId: string }> }) => {
    const { commentId } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { data: existing } = await supabase
      .from("content_comments")
      .select("user_id")
      .eq("id", commentId)
      .maybeSingle();
    if (!existing) throw new ApiError("NOT_FOUND", "Comentário não encontrado");
    if (existing.user_id !== user.id) {
      throw new ApiError("FORBIDDEN", "Você só pode excluir seus próprios comentários");
    }

    const { error } = await supabase.from("content_comments").delete().eq("id", commentId);
    if (error) {
      console.error("[comments.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover comentário");
    }
    return NextResponse.json({ success: true });
  }
);
