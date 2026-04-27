import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";

const checkBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const POST = withErrorHandling(
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

    let raw: unknown = {};
    try {
      raw = await request.json();
    } catch {
      // body vazio é aceitável
    }
    const body = checkBodySchema.parse(raw ?? {});
    const checkDate = body.date ?? new Date().toLocaleDateString("en-CA");

    const { data: existing } = await supabase
      .from("routine_checks")
      .select("id")
      .eq("routine_item_id", id)
      .eq("check_date", checkDate)
      .maybeSingle();

    if (existing) {
      await supabase.from("routine_checks").delete().eq("id", existing.id);
      return NextResponse.json({ checked: false, date: checkDate });
    }

    const { error } = await supabase.from("routine_checks").insert({
      id: "rcheck-" + genId(),
      routine_item_id: id,
      user_id: user.id,
      check_date: checkDate,
    });
    if (error) {
      console.error("[routines.check.POST] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao registrar check");
    }
    return NextResponse.json({ checked: true, date: checkDate });
  }
);
