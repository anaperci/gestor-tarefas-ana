import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    if (id === user.id) {
      throw new ApiError("BAD_REQUEST", "Não pode deletar a si mesmo");
    }

    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
      console.error("[users.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover usuário");
    }
    return NextResponse.json({ success: true });
  }
);
