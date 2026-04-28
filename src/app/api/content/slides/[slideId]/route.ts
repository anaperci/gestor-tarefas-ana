import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { slideSchema } from "@/lib/content-schemas";

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ slideId: string }> }) => {
    const { slideId } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const body = await parseJson(request, slideSchema);
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.body !== undefined) updates.body = body.body;
    if (body.notes !== undefined) updates.notes = body.notes;

    const { error } = await supabase.from("content_slides").update(updates).eq("id", slideId);
    if (error) {
      console.error("[slides.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar slide");
    }
    return NextResponse.json({ success: true });
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ slideId: string }> }) => {
    const { slideId } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { error } = await supabase.from("content_slides").delete().eq("id", slideId);
    if (error) {
      console.error("[slides.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover slide");
    }
    return NextResponse.json({ success: true });
  }
);
