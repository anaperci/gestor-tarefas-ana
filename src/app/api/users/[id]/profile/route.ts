import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { emailSchema, nameSchema } from "@/lib/validation";

const profileSchema = z.object({
  name: nameSchema.optional(),
  // "" limpa o email; ausente = não mexe
  email: z.union([emailSchema, z.literal("")]).optional(),
});

/** Atualiza dados editáveis do user (nome, email). Avatar tem rota própria. */
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

    if (body.email !== undefined) {
      const emailLower = body.email.toLowerCase().trim() || null;
      if (emailLower) {
        const { data: clash } = await supabase
          .from("users")
          .select("id")
          .eq("email", emailLower)
          .neq("id", id)
          .is("deleted_at", null)
          .maybeSingle();
        if (clash) throw new ApiError("CONFLICT", "Email já está em uso por outro usuário");
      }
      updates.email = emailLower;
    }

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
