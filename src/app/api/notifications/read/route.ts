import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { parseJson, withErrorHandling } from "@/lib/api-error";

const readSchema = z.object({ ids: z.array(z.string()).optional() });

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const { ids } = await parseJson(request, readSchema);

  let query = supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  // Sem ids = marca todas como lidas; com ids = só as informadas
  if (ids && ids.length > 0) query = query.in("id", ids);

  const { error } = await query;
  if (error) {
    console.error("[notifications.read.POST] failed:", error);
  }
  return NextResponse.json({ success: true });
});
