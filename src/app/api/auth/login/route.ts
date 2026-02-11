import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyPassword, upgradePasswordIfNeeded, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Username e senha obrigatórios" }, { status: 400 });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username.toLowerCase().trim())
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  // Auto-upgrade legacy hash to bcrypt
  await upgradePasswordIfNeeded(user.id, password, user.password_hash);

  const token = generateToken(user);
  return NextResponse.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar },
  });
}
