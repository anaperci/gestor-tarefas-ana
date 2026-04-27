import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { longTextSchema, titleSchema } from "@/lib/validation";

const updateNoteSchema = z.object({
  title: titleSchema.optional(),
  content: longTextSchema.optional(),
  pinned: z.boolean().optional(),
});

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const { data: note } = await supabase
      .from("notes")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!note) throw new ApiError("NOT_FOUND", "Nota não encontrada");
    if (note.user_id !== user.id) throw new ApiError("FORBIDDEN", "Sem acesso");

    const body = await parseJson(request, updateNoteSchema);

    const { error } = await supabase
      .from("notes")
      .update({
        title: body.title ?? note.title,
        content: body.content ?? note.content,
        pinned: body.pinned ?? note.pinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[notes.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar nota");
    }

    const { data: updated } = await supabase.from("notes").select("*").eq("id", id).single();
    return NextResponse.json({
      ...updated,
      pinned: !!updated!.pinned,
      userId: updated!.user_id,
      createdAt: updated!.created_at,
      updatedAt: updated!.updated_at,
    });
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const { data: note } = await supabase
      .from("notes")
      .select("user_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!note) throw new ApiError("NOT_FOUND", "Nota não encontrada");
    if (note.user_id !== user.id) throw new ApiError("FORBIDDEN", "Sem acesso");

    // Soft delete: preserva auditoria
    const { error } = await supabase
      .from("notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[notes.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover nota");
    }
    return NextResponse.json({ success: true });
  }
);
