import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, hashPassword, verifyPassword } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { passwordSchema } from "@/lib/password-policy";

/**
 * - Admin pode mudar senha de qualquer user (sem currentPassword)
 * - User pode mudar a própria senha (precisa enviar currentPassword)
 */
const passwordChangeSchema = z.object({
  password: passwordSchema,
  currentPassword: z.string().min(1).max(128).optional(),
});

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const isSelf = user.id === id;
    if (!isSelf && user.role !== "admin") {
      throw new ApiError("FORBIDDEN", "Só admin ou o próprio user podem trocar esta senha");
    }

    const { password, currentPassword } = await parseJson(request, passwordChangeSchema);

    // Self-change: exige senha atual correta
    if (isSelf) {
      if (!currentPassword) {
        throw new ApiError("VALIDATION_ERROR", "Informe a senha atual");
      }
      const { data: row } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!row) throw new ApiError("NOT_FOUND", "Usuário não encontrado");
      const ok = await verifyPassword(currentPassword, row.password_hash);
      if (!ok) throw new ApiError("AUTH_REQUIRED", "Senha atual incorreta");
    }

    const { error } = await supabase
      .from("users")
      .update({ password_hash: await hashPassword(password) })
      .eq("id", id);

    if (error) {
      console.error("[users.password.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar senha");
    }

    await audit({
      action: "user.password.change",
      resource: "users",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: { self: isSelf },
      request,
    });
    return NextResponse.json({ success: true });
  }
);
