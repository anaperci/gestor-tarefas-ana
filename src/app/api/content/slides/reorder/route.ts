import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { idSchema } from "@/lib/validation";

const reorderSchema = z.object({
  ids: z.array(idSchema).max(100),
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertContentAccess(user);

  const { ids } = await parseJson(request, reorderSchema);

  // Upsert posições
  const updates = ids.map((id, idx) =>
    supabase.from("content_slides").update({ sort_order: idx, slide_number: idx + 1 }).eq("id", id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("[slides.reorder] failed:", failed.error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao reordenar slides");
  }
  return NextResponse.json({ success: true });
});
