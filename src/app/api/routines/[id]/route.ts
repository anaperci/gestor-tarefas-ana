import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { titleSchema } from "@/lib/validation";

const updateRoutineSchema = z.object({
  title: titleSchema.optional(),
  sort_order: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});

/** Vazio vira a semana toda; remove duplicados e ordena. */
function normalizeDays(days: number[]): number[] {
  const set = Array.from(new Set(days)).sort((a, b) => a - b);
  return set.length ? set : [0, 1, 2, 3, 4, 5, 6];
}

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const { data: item } = await supabase
      .from("routine_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!item) throw new ApiError("NOT_FOUND", "Item não encontrado");
    if (item.user_id !== user.id) throw new ApiError("FORBIDDEN", "Sem acesso");

    const body = await parseJson(request, updateRoutineSchema);

    const { error } = await supabase
      .from("routine_items")
      .update({
        title: body.title ?? item.title,
        sort_order: body.sort_order ?? item.sort_order,
        active: body.active ?? item.active,
        days: body.days ? normalizeDays(body.days) : (item.days ?? [0, 1, 2, 3, 4, 5, 6]),
      })
      .eq("id", id);

    if (error) {
      console.error("[routines.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar item");
    }

    const { data: updated } = await supabase
      .from("routine_items")
      .select("*")
      .eq("id", id)
      .single();
    return NextResponse.json({
      ...updated,
      active: !!updated!.active,
      userId: updated!.user_id,
      days: updated!.days ?? [0, 1, 2, 3, 4, 5, 6],
      createdAt: updated!.created_at,
    });
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const { data: item } = await supabase
      .from("routine_items")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();
    if (!item) throw new ApiError("NOT_FOUND", "Item não encontrado");
    if (item.user_id !== user.id) throw new ApiError("FORBIDDEN", "Sem acesso");

    // Soft delete preserva histórico de check
    const { error } = await supabase
      .from("routine_items")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      console.error("[routines.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover item");
    }
    return NextResponse.json({ success: true });
  }
);
