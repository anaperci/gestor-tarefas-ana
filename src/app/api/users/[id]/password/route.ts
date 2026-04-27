import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin, hashPassword } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { passwordSchema } from "@/lib/password-policy";

const passwordChangeSchema = z.object({ password: passwordSchema });

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    const { password } = await parseJson(request, passwordChangeSchema);

    const { error } = await supabase
      .from("users")
      .update({ password_hash: await hashPassword(password) })
      .eq("id", id);

    if (error) {
      console.error("[users.password.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar senha");
    }
    return NextResponse.json({ success: true });
  }
);
