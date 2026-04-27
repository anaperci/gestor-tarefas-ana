import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { hashPassword, generateToken } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { genId } from "@/lib/utils";
import { nameSchema, usernameSchema } from "@/lib/validation";
import { passwordSchema } from "@/lib/password-policy";

const setupBodySchema = z.object({
  username: usernameSchema,
  name: nameSchema,
  password: passwordSchema,
});

/**
 * GET — devolve { setupRequired: boolean }. Permite o front decidir se
 * deve mostrar /setup ou /login.
 */
export const GET = withErrorHandling(async () => {
  const { count } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  return NextResponse.json({ setupRequired: !count || count === 0 });
});

/**
 * POST — cria o primeiro admin. Só funciona enquanto a tabela users estiver
 * vazia (proteção contra escalonamento de privilégio em produção).
 */
export const POST = withErrorHandling(async (request) => {
  const { count } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  if (count && count > 0) {
    throw new ApiError("FORBIDDEN", "Setup já foi concluído. Use a tela de login.");
  }

  const { username, name, password } = await parseJson(request, setupBodySchema);
  const usernameLower = username.toLowerCase().trim();

  const id = "user-" + genId();
  const { error } = await supabase.from("users").insert({
    id,
    username: usernameLower,
    name: name.trim(),
    password_hash: await hashPassword(password),
    role: "admin",
    avatar: "👑",
  });

  if (error) {
    console.error("[setup.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar primeiro administrador");
  }

  await audit({
    action: "user.create",
    resource: "users",
    resourceId: id,
    actorId: id,
    actorRole: "admin",
    metadata: { firstAdmin: true, username: usernameLower },
    request,
  });

  const token = generateToken({ id, username: usernameLower, role: "admin" });
  return NextResponse.json(
    {
      token,
      user: { id, username: usernameLower, name: name.trim(), role: "admin", avatar: "👑" },
    },
    { status: 201 }
  );
});
