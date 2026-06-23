import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { parseJson, withErrorHandling } from "@/lib/api-error";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { sendAccessEmail } from "@/lib/reset-token";

// Aceita email OU username — campo único "identifier"
const forgotSchema = z.object({
  identifier: z.string().min(1).max(120),
});

export const POST = withErrorHandling(async (request) => {
  consumeRateLimit(clientIp(request as NextRequest), {
    key: "forgot-password",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  const { identifier } = await parseJson(request, forgotSchema);
  const value = identifier.toLowerCase().trim();

  const { data: user } = await supabase
    .from("users")
    .select("id, name, email")
    .or(`username.eq.${value},email.eq.${value}`)
    .is("deleted_at", null)
    .maybeSingle();

  // Só envia se achou o usuário E ele tem email cadastrado.
  // Resposta é sempre genérica — evita enumeração de contas.
  if (user?.email) {
    try {
      await sendAccessEmail({ id: user.id, name: user.name, email: user.email }, "reset");
    } catch (err) {
      console.error("[forgot-password] envio falhou:", err);
    }
  }

  return NextResponse.json({
    success: true,
    message: "Se houver uma conta com esse email, você receberá um link de redefinição.",
  });
});
