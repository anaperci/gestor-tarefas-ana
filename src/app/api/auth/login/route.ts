import { consumeRateLimit, clientIp } from "@/lib/rate-limit";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { verifyPassword, upgradePasswordIfNeeded, sessionResponse } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";

const loginSchema = z.object({
  // Login é por NOME DE USUÁRIO.
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(128),
});

export const POST = withErrorHandling(async (request) => {
  await consumeRateLimit(clientIp(request), { key: "login-ip", limit: 30, windowMs: 900_000 });
  const { username, password } = await parseJson(request, loginSchema);
  const login = username.toLowerCase().trim();
  await consumeRateLimit(login, { key: "login-account", limit: 15, windowMs: 900_000 });

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("username", login)
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

  const { data: refreshed } = await supabase.from("users").select("*").eq("id", user.id).single();
  return sessionResponse(refreshed!);
});
