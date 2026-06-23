import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { supabase } from "./supabase";
import { ApiError } from "./api-error";

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
  role: "admin" | "editor" | "viewer";
  avatar: string;
  canAccessContent: boolean;
}

// Legacy hash — kept ONLY to migrate old passwords on first successful login.
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
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(pwd, storedHash);
  }
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

/**
 * Lê o Bearer token, valida assinatura e devolve o usuário.
 * Lança ApiError em qualquer falha — handlers só precisam chamar isso.
 */
export async function requireAuth(request: Request | NextRequest): Promise<AuthUser> {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError("AUTH_REQUIRED", "Token não fornecido");
  }

  let decoded: { id: string; iat?: number };
  try {
    decoded = jwt.verify(header.split(" ")[1], getJwtSecret()) as { id: string; iat?: number };
  } catch {
    throw new ApiError("AUTH_REQUIRED", "Token inválido");
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, username, name, role, avatar, can_access_content, password_changed_at")
    .eq("id", decoded.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) throw new ApiError("AUTH_REQUIRED", "Usuário não encontrado");

  // Revoga sessões emitidas ANTES da última troca de senha (ex.: após
  // "esqueci minha senha", o token roubado deixa de valer). Tolerância de 5s
  // pra evitar corrida de relógio entre emissão e carimbo.
  if (user.password_changed_at && decoded.iat) {
    const changedMs = new Date(user.password_changed_at).getTime();
    if (decoded.iat * 1000 < changedMs - 5000) {
      throw new ApiError("AUTH_REQUIRED", "Sessão expirada. Faça login novamente.");
    }
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    canAccessContent: !!user.can_access_content,
  } as AuthUser;
}

export function assertAdmin(user: AuthUser): void {
  if (user.role !== "admin") {
    throw new ApiError("FORBIDDEN", "Acesso negado. Apenas admins.");
  }
}

export function assertEditorOrAdmin(user: AuthUser): void {
  if (user.role === "viewer") {
    throw new ApiError("FORBIDDEN", "Acesso negado. Viewers não podem editar.");
  }
}

export function assertContentAccess(user: AuthUser): void {
  if (!user.canAccessContent) {
    throw new ApiError("FORBIDDEN", "Você não tem acesso ao Hub de Conteúdo.");
  }
}
