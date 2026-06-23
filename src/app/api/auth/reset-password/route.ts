import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { passwordSchema } from "@/lib/password-policy";
import { hashResetToken, RESET_PURPOSE } from "@/lib/password-reset";

const resetSchema = z.object({
  token: z.string().min(1).max(512),
  password: passwordSchema,
});

interface TokenRow {
  id: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
}

function isUsable(row: TokenRow | null): row is TokenRow {
  return !!row && !row.used_at && new Date(row.expires_at).getTime() > Date.now();
}

/** GET ?token=... → valida o link antes de mostrar o formulário (UX). */
export const GET = withErrorHandling(async (request) => {
  // Rate-limit por IP — barra brute-force de tokens via endpoint de validação.
  consumeRateLimit(clientIp(request as NextRequest), {
    key: "reset-password-validate",
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ valid: false });

  const { data } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", hashResetToken(token))
    .eq("purpose", RESET_PURPOSE)
    .maybeSingle();

  return NextResponse.json({ valid: isUsable(data as TokenRow | null) });
});

/** POST { token, password } → troca a senha se o token for válido e não usado. */
export const POST = withErrorHandling(async (request) => {
  consumeRateLimit(clientIp(request as NextRequest), {
    key: "reset-password",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  const { token, password } = await parseJson(request, resetSchema);

  const { data: row } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", hashResetToken(token))
    .eq("purpose", RESET_PURPOSE)
    .maybeSingle();

  if (!isUsable(row as TokenRow | null)) {
    throw new ApiError("BAD_REQUEST", "Link inválido ou expirado. Solicite um novo.");
  }
  const tokenRow = row as TokenRow;

  // Reivindica o token de forma atômica (uso único, à prova de corrida):
  // só "consome" se used_at ainda for null. Se nada voltar, já foi usado.
  const { data: claimed, error: claimErr } = await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .is("used_at", null)
    .select("id");

  if (claimErr) {
    console.error("[reset-password] falha ao consumir token:", claimErr);
    throw new ApiError("INTERNAL_ERROR", "Falha ao redefinir senha. Tente novamente.");
  }
  if (!claimed || claimed.length === 0) {
    throw new ApiError("BAD_REQUEST", "Este link já foi utilizado. Solicite um novo.");
  }

  const { error: pwErr } = await supabase
    .from("users")
    .update({
      password_hash: await hashPassword(password),
      password_changed_at: new Date().toISOString(), // revoga sessões antigas
    })
    .eq("id", tokenRow.user_id)
    .is("deleted_at", null);

  if (pwErr) {
    console.error("[reset-password] falha ao atualizar senha:", pwErr);
    // Falha transitória não deve "queimar" o token — devolve o claim pra retry.
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: null })
      .eq("id", tokenRow.id);
    throw new ApiError("INTERNAL_ERROR", "Falha ao redefinir senha. Tente novamente.");
  }

  // Invalida quaisquer outros tokens de reset pendentes do mesmo usuário.
  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", tokenRow.user_id)
    .eq("purpose", RESET_PURPOSE)
    .is("used_at", null);

  await audit({
    action: "user.password.reset",
    resource: "users",
    resourceId: tokenRow.user_id,
    request,
  });

  return NextResponse.json({ success: true });
});
