import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { parseJson, withErrorHandling } from "@/lib/api-error";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { genId } from "@/lib/utils";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import {
  RESET_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MIN,
  RESET_PURPOSE,
  generateResetToken,
  buildResetUrl,
  baseUrlFromRequest,
  resetEmailHtml,
  resetEmailText,
} from "@/lib/password-reset";

const schema = z.object({ email: z.string().email().max(255) });

/** Resposta genérica — nunca revela se o email existe (anti-enumeração). */
const GENERIC_OK = {
  success: true as const,
  message: "Se houver uma conta com esse email, enviamos as instruções de redefinição.",
};

export const POST = withErrorHandling(async (request) => {
  const ip = clientIp(request as NextRequest);
  // Throttle por IP (best-effort em serverless — ver lib/rate-limit).
  consumeRateLimit(ip, { key: "forgot-password-ip", limit: 5, windowMs: 15 * 60 * 1000 });

  const { email } = await parseJson(request, schema);
  const normalized = email.toLowerCase().trim();

  // Throttle por email: evita inundar a caixa de uma vítima. Se estourar,
  // ainda devolvemos a resposta genérica (não vira erro pro usuário final).
  let emailAllowed = true;
  try {
    consumeRateLimit(normalized, { key: "forgot-password-email", limit: 3, windowMs: 60 * 60 * 1000 });
  } catch {
    emailAllowed = false;
  }

  if (emailAllowed) {
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("email", normalized)
      .is("deleted_at", null)
      .maybeSingle();

    if (user?.email) {
      // Invalida tokens de reset anteriores ainda não usados desse usuário.
      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("purpose", RESET_PURPOSE)
        .is("used_at", null);

      const { raw, hash } = generateResetToken();
      const { error: insErr } = await supabase.from("password_reset_tokens").insert({
        id: "prt-" + genId(),
        user_id: user.id,
        token_hash: hash,
        purpose: RESET_PURPOSE,
        expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
        requested_ip: ip,
      });

      if (insErr) {
        console.error("[forgot-password] falha ao gravar token:", insErr);
      } else {
        const resetUrl = buildResetUrl(baseUrlFromRequest(request), raw);
        try {
          await sendEmail({
            to: { email: user.email, name: user.name },
            subject: "Redefinição de senha — Ordum",
            html: resetEmailHtml({ name: user.name, resetUrl, ttlMinutes: RESET_TOKEN_TTL_MIN }),
            text: resetEmailText({ name: user.name, resetUrl, ttlMinutes: RESET_TOKEN_TTL_MIN }),
            tags: ["password-reset"],
          });
          await audit({
            action: "user.password.reset_request",
            resource: "users",
            resourceId: user.id,
            metadata: { email: normalized },
            request,
          });
        } catch (err) {
          // Falha de envio não vaza pro usuário — log interno e resposta genérica.
          console.error("[forgot-password] falha ao enviar email:", err);
        }
      }
    }
  }

  return NextResponse.json(GENERIC_OK);
});
