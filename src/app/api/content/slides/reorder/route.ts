import { assertSlideAccess } from "@/lib/access";
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

  const parents = await Promise.all(ids.map(id => assertSlideAccess(user, id)));
  if (new Set(parents).size > 1 || new Set(ids).size !== ids.length) throw new ApiError("VALIDATION_ERROR", "Slides inválidos para reordenação");
  if(ids.length) await supabase.rpc("reorder_content_slides",{p_content_id:parents[0],p_ids:ids});
  return NextResponse.json({ success: true });
});
