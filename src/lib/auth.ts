import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "./supabase";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

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

// Legacy hash — only used for migration from old passwords
function legacyHash(pwd: string): string {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

export async function hashPassword(pwd: string): Promise<string> {
  return bcrypt.hash(pwd, 10);
}

export async function verifyPassword(pwd: string, storedHash: string): Promise<boolean> {
  // If it's a bcrypt hash, verify with bcrypt
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(pwd, storedHash);
  }
  // Legacy hash — check and auto-upgrade
  return legacyHash(pwd) === storedHash;
}

export async function upgradePasswordIfNeeded(userId: string, pwd: string, storedHash: string): Promise<void> {
  if (!storedHash.startsWith("$2")) {
    const newHash = await hashPassword(pwd);
    await supabase.from("users").update({ password_hash: newHash }).eq("id", userId);
  }
}

export function generateToken(user: { id: string; username: string; role: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export async function authenticate(request: NextRequest): Promise<AuthResult> {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return { error: "Token não fornecido" };
  }

  try {
    const decoded = jwt.verify(header.split(" ")[1], getJwtSecret()) as { id: string };
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
