import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";

const bodySchema = z.object({ canAccessContent: z.boolean() });

/** Liga/desliga can_access_content de um usuário (apenas admin). */
export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    const { canAccessContent } = await parseJson(request, bodySchema);

    const { error } = await supabase
      .from("users")
      .update({ can_access_content: canAccessContent })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("[users.content-access.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar acesso");
    }

    await audit({
      action: "user.profile.update",
      resource: "users",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: { field: "can_access_content", value: canAccessContent },
      request,
    });

    return NextResponse.json({ success: true, canAccessContent });
  }
);
