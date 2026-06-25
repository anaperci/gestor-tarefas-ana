import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    const { error } = await supabase
      .from("meeting_transcriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new ApiError("INTERNAL_ERROR", "Falha ao remover");
    return NextResponse.json({ success: true });
  }
);
