import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate, requireAdmin, hashPassword } from "@/lib/auth";
import { genId } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const { data: users } = await supabase
    .from("users")
    .select("id, username, name, role, avatar, created_at");

  return NextResponse.json(users || []);
}

export async function POST(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const adminCheck = requireAdmin(authResult.user!);
  if (adminCheck) return adminCheck;

  const { username, name, password, role } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Username e senha obrigatórios" }, { status: 400 });
  }
  if (!["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Role inválida" }, { status: 400 });
  }

  const { data: exists } = await supabase
    .from("users")
    .select("id")
    .eq("username", username.toLowerCase().trim())
    .single();

  if (exists) {
    return NextResponse.json({ error: "Username já existe" }, { status: 409 });
  }

  const avatars: Record<string, string> = { admin: "👑", editor: "✏️", viewer: "👁️" };
  const id = "user-" + genId();
  const usernameLower = username.toLowerCase().trim();

  const { error } = await supabase.from("users").insert({
    id,
    username: usernameLower,
    name: name || username,
    password_hash: hashPassword(password),
    role,
    avatar: avatars[role] || "👤",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { id, username: usernameLower, name: name || username, role, avatar: avatars[role] },
    { status: 201 }
  );
}
