import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { verifyPassword, upgradePasswordIfNeeded, generateToken } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";

const loginSchema = z.object({
  // Login é por NOME DE USUÁRIO.
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(128),
});

export const POST = withErrorHandling(async (request) => {
  const { username, password } = await parseJson(request, loginSchema);
  const login = username.toLowerCase().trim();

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

  const token = generateToken(user);
  return NextResponse.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      canAccessContent: !!user.can_access_content,
    },
  });
});
