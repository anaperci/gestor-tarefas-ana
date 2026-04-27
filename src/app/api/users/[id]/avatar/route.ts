import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { emojiSchema } from "@/lib/validation";

// Aceita emoji curto OU um seed alfanumérico (DiceBear)
const avatarSchema = z.union([
  emojiSchema,
  z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Seed deve ser alfanumérico"),
]);

const bodySchema = z.object({ avatar: avatarSchema });

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    // O próprio user pode mudar seu avatar; admins podem mudar de qualquer um
    if (id !== user.id && user.role !== "admin") {
      throw new ApiError("FORBIDDEN", "Só o próprio usuário ou um admin pode trocar este avatar");
    }

    const { avatar } = await parseJson(request, bodySchema);

    const { error } = await supabase
      .from("users")
      .update({ avatar })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("[users.avatar.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar avatar");
    }

    await audit({
      action: "user.avatar.change",
      resource: "users",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: { new: avatar },
      request,
    });

    return NextResponse.json({ success: true, avatar });
  }
);
