import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "./supabase";

const JWT_SECRET = process.env.JWT_SECRET || "taskhub-secret-key-change-in-prod";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar: string;
}

interface AuthResult {
  user?: AuthUser;
  error?: string;
}

export function hashPassword(pwd: string): string {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

export function generateToken(user: { id: string; username: string; role: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function authenticate(request: NextRequest): Promise<AuthResult> {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return { error: "Token não fornecido" };
  }

  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET) as { id: string };
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, name, role, avatar")
      .eq("id", decoded.id)
      .single();

    if (error || !user) return { error: "Usuário não encontrado" };
    return { user: user as AuthUser };
  } catch {
    return { error: "Token inválido" };
  }
}

export function requireAdmin(user: AuthUser): NextResponse | null {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado. Apenas admins." }, { status: 403 });
  }
  return null;
}

export function requireEditorOrAdmin(user: AuthUser): NextResponse | null {
  if (user.role === "viewer") {
    return NextResponse.json(
      { error: "Acesso negado. Viewers não podem editar." },
      { status: 403 }
    );
  }
  return null;
}
