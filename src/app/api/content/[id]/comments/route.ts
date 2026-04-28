import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { commentSchema } from "@/lib/content-schemas";
import { rowToComment, type CommentRow } from "@/lib/content";

export const GET = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { data } = await supabase
      .from("content_comments")
      .select("*")
      .eq("content_item_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json((data ?? []).map((r) => rowToComment(r as CommentRow)));
  }
);

export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { body } = await parseJson(request, commentSchema);

    const commentId = "ccmt-" + genId();
    const { error } = await supabase.from("content_comments").insert({
      id: commentId,
      content_item_id: id,
      user_id: user.id,
      body,
    });
    if (error) {
      console.error("[comments.POST] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao criar comentário");
    }

    const { data } = await supabase.from("content_comments").select("*").eq("id", commentId).single();
    return NextResponse.json(rowToComment(data as CommentRow), { status: 201 });
  }
);
