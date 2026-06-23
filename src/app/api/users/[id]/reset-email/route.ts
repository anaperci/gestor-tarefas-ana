import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { sendAccessEmail } from "@/lib/reset-token";
import { isEmailConfigured } from "@/lib/email";

/** Admin dispara um email de redefinição de senha para o usuário. */
export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    const { data: target } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!target) throw new ApiError("NOT_FOUND", "Usuário não encontrado");
    if (!target.email) {
      throw new ApiError("VALIDATION_ERROR", "Esse usuário não tem email cadastrado.");
    }
    if (!isEmailConfigured()) {
      throw new ApiError("INTERNAL_ERROR", "Envio de email não configurado (Brevo).");
    }

    await sendAccessEmail({ id: target.id, name: target.name, email: target.email }, "reset");

    return NextResponse.json({ success: true });
  }
);
