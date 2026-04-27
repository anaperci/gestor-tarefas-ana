import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { roleSchema } from "@/lib/validation";

const roleUpdateSchema = z.object({ role: roleSchema });

const ROLE_AVATARS: Record<string, string> = { admin: "👑", editor: "✏️", viewer: "👁️" };

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    // FASE1.8 — bloquear self-role: admin não pode rebaixar/promover a si mesmo
    if (id === user.id) {
      throw new ApiError("FORBIDDEN", "Não é permitido alterar o próprio role");
    }

    const { role } = await parseJson(request, roleUpdateSchema);

    const { error } = await supabase
      .from("users")
      .update({ role, avatar: ROLE_AVATARS[role] })
      .eq("id", id);

    if (error) {
      console.error("[users.role.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar role");
    }
    return NextResponse.json({ success: true });
  }
);
