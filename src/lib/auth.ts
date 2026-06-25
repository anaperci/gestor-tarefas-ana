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

  let decoded: { id: string };
  try {
    decoded = jwt.verify(header.split(" ")[1], getJwtSecret()) as { id: string };
  } catch {
    throw new ApiError("AUTH_REQUIRED", "Token inválido");
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, username, name, role, avatar, can_access_content")
    .eq("id", decoded.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) throw new ApiError("AUTH_REQUIRED", "Usuário não encontrado");
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

/** Admin sempre pode; senão precisa ser o dono (gestor) do workspace. */
export function assertCanManageWorkspace(user: AuthUser, workspaceOwnerId: string): void {
  if (user.role === "admin") return;
  if (user.id !== workspaceOwnerId) {
    throw new ApiError("FORBIDDEN", "Apenas o admin ou o gestor do workspace.");
  }
}

export function assertContentAccess(user: AuthUser): void {
  if (!user.canAccessContent) {
    throw new ApiError("FORBIDDEN", "Você não tem acesso ao Hub de Conteúdo.");
  }
}

/**
 * Garante que o usuário tem acesso à tarefa (e a recursos vinculados a ela,
 * como anexos/menções). Admin sempre; senão: dono do projeto, membro do
 * workspace do projeto, share do projeto, ou responsável pela tarefa.
 */
export async function assertTaskAccess(user: AuthUser, taskId: string): Promise<void> {
  if (user.role === "admin") return;

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id, assigned_to")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");
  if (task.assigned_to === user.id) return;

  const { data: proj } = await supabase
    .from("projects")
    .select("owner_id, workspace_id")
    .eq("id", task.project_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (proj) {
    if (proj.owner_id === user.id) return;
    if (proj.workspace_id) {
      const { data: member } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", proj.workspace_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (member) return;
    }
    const { data: share } = await supabase
      .from("project_shares")
      .select("user_id")
      .eq("project_id", task.project_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (share) return;
  }

  throw new ApiError("FORBIDDEN", "Você não tem acesso a esta tarefa.");
}

/** IDs dos workspaces que o usuário pode ver. Admin → null (todos). */
export async function getAccessibleWorkspaceIds(user: AuthUser): Promise<string[] | null> {
  if (user.role === "admin") return null;
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id);
  return (data ?? []).map((r) => r.workspace_id as string);
}
