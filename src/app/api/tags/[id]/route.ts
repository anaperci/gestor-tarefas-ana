import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { colorSchema } from "@/lib/validation";

const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  color: colorSchema.optional(),
});

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    const body = await parseJson(request, updateSchema);
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.color !== undefined) updates.color = body.color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, noop: true });
    }

    const { error } = await supabase
      .from("tags")
      .update(updates)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("[tags.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar etiqueta");
    }
    return NextResponse.json({ success: true });
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    const { error } = await supabase
      .from("tags")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("[tags.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover etiqueta");
    }
    return NextResponse.json({ success: true });
  }
);
