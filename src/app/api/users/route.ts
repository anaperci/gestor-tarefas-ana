import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin, hashPassword } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { nameSchema, roleSchema, usernameSchema } from "@/lib/validation";
import { passwordSchema } from "@/lib/password-policy";

const ROLE_AVATARS: Record<string, string> = { admin: "👑", editor: "✏️", viewer: "👁️" };

const createUserSchema = z.object({
  username: usernameSchema,
  name: nameSchema.optional(),
  password: passwordSchema,
  role: roleSchema,
});

export const GET = withErrorHandling(async (request) => {
  await requireAuth(request);
  const { data: users } = await supabase
    .from("users")
    .select("id, username, name, role, avatar, created_at")
    .is("deleted_at", null);
  return NextResponse.json(users ?? []);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertAdmin(user);

  const { username, name, password, role } = await parseJson(request, createUserSchema);
  const usernameLower = username.toLowerCase().trim();

  const { data: exists } = await supabase
    .from("users")
    .select("id")
    .eq("username", usernameLower)
    .is("deleted_at", null)
    .maybeSingle();

  if (exists) throw new ApiError("CONFLICT", "Username já existe");

  const id = "user-" + genId();
  const finalName = name?.trim() || usernameLower;
  const avatar = ROLE_AVATARS[role] ?? "👤";

  const { error } = await supabase.from("users").insert({
    id,
    username: usernameLower,
    name: finalName,
    password_hash: await hashPassword(password),
    role,
    avatar,
  });

  if (error) {
    console.error("[users.POST] insert failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar usuário");
  }

  return NextResponse.json(
    { id, username: usernameLower, name: finalName, role, avatar },
    { status: 201 }
  );
});
