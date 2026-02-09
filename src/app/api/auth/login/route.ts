import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { hashPassword, generateToken } from "@/lib/auth";

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

  if (user.password_hash !== hashPassword(password)) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const token = generateToken(user);
  return NextResponse.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar },
  });
}
