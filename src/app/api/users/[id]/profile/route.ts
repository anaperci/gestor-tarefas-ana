import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { nameSchema } from "@/lib/validation";

const profileSchema = z.object({
  name: nameSchema.optional(),
});

/** Atualiza dados editáveis do próprio user (nome). Avatar tem rota própria. */
export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    if (user.id !== id && user.role !== "admin") {
      throw new ApiError("FORBIDDEN", "Só admin ou o próprio user pode editar este perfil");
    }

    const body = await parseJson(request, profileSchema);
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, noop: true });
    }

    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("[users.profile.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar perfil");
    }

    await audit({
      action: "user.profile.update",
      resource: "users",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: { fields: Object.keys(updates) },
      request,
    });

    return NextResponse.json({ success: true });
  }
);
