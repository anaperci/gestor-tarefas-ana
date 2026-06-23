import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { hashPassword } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/password-policy";
import { verifyToken, consumeToken } from "@/lib/reset-token";
import { audit } from "@/lib/audit";

const resetSchema = z.object({
  token: z.string().min(16).max(128),
  password: passwordSchema,
});

export const POST = withErrorHandling(async (request) => {
  consumeRateLimit(clientIp(request as NextRequest), {
    key: "reset-password",
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  const { token, password } = await parseJson(request, resetSchema);

  const valid = await verifyToken(token);
  if (!valid) {
    throw new ApiError("AUTH_REQUIRED", "Link inválido ou expirado. Solicite um novo.");
  }

  const { error } = await supabase
    .from("users")
    .update({ password_hash: await hashPassword(password) })
    .eq("id", valid.userId);
  if (error) {
    console.error("[reset-password] update failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao redefinir senha");
  }

  await consumeToken(valid.id);

  await audit({
    action: "user.password.change",
    resource: "users",
    resourceId: valid.userId,
    actorId: valid.userId,
    metadata: { via: "reset-token" },
    request,
  });

  return NextResponse.json({ success: true });
});
