import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { verifyPassword, upgradePasswordIfNeeded, generateToken } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  username: z.string().min(1).max(40),
  password: z.string().min(1).max(128),
});

export const POST = withErrorHandling(async (request) => {
  consumeRateLimit(clientIp(request as NextRequest), {
    key: "login",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  const { username, password } = await parseJson(request, loginSchema);

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("username", username.toLowerCase().trim())
    .is("deleted_at", null)
    .maybeSingle();

  // Mensagem genérica para evitar user enumeration
  if (!user) {
    throw new ApiError("AUTH_REQUIRED", "Usuário ou senha inválidos");
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new ApiError("AUTH_REQUIRED", "Usuário ou senha inválidos");
  }

  await upgradePasswordIfNeeded(user.id, password, user.password_hash);

  const token = generateToken(user);
  return NextResponse.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar },
  });
});
