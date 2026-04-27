import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    if (id === user.id) {
      throw new ApiError("BAD_REQUEST", "Não pode deletar a si mesmo");
    }

    // Soft delete: preserva FKs, histórico e auditoria
    const { error } = await supabase
      .from("users")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("[users.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover usuário");
    }

    await audit({
      action: "user.delete",
      resource: "users",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      request,
    });
    return NextResponse.json({ success: true });
  }
);
