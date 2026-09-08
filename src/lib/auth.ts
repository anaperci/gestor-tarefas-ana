import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { userCanAccessProject } from "./access";
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

function passwordVersion(hash: string): string { return createHmac("sha256", getJwtSecret()).update(hash).digest("hex"); }
export function sessionResponse(user: Record<string, unknown>, status = 200): NextResponse {
  const response = NextResponse.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role, avatar: user.avatar, canAccessContent: !!user.can_access_content } }, { status });
  response.cookies.set("clareza-session", generateToken(user as {id:string;username:string;role:string;password_hash:string}), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 7 * 86400 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export function generateToken(user: { id: string; username: string; role: string; password_hash: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, ver: passwordVersion(user.password_hash) },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

/**
 * Lê o cookie HttpOnly, valida assinatura e devolve o usuário.
 * Lança ApiError em qualquer falha — handlers só precisam chamar isso.
 */
export async function requireAuth(request: Request | NextRequest): Promise<AuthUser> {
  const cookie = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("clareza-session="))?.slice("clareza-session=".length);
  if (!cookie) throw new ApiError("AUTH_REQUIRED", "Sessão não fornecida");
  let decoded: { id: string; ver: string };
  try { decoded = jwt.verify(cookie, getJwtSecret(), { algorithms: ["HS256"] }) as typeof decoded; }
  catch { throw new ApiError("AUTH_REQUIRED", "Sessão expirada. Entre novamente."); }
  const { data: user, error } = await supabase.from("users")
    .select("id, username, name, role, avatar, can_access_content, password_hash")
    .eq("id", decoded.id).is("deleted_at", null).maybeSingle();
  if (error) throw new ApiError("INTERNAL_ERROR", "Não foi possível verificar a sessão. Tente novamente.");
  if (user) {
    const expected = passwordVersion(user.password_hash);
    if (typeof decoded.ver !== "string" || decoded.ver.length !== expected.length || !timingSafeEqual(Buffer.from(decoded.ver), Buffer.from(expected)))
      throw new ApiError("AUTH_REQUIRED", "A senha foi alterada. Entre novamente.");
  }
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
 * como anexos/menções), usando a mesma regra central da listagem de projetos.
 */
export async function assertTaskAccess(user: AuthUser, taskId: string): Promise<void> {
  const { data: task } = await supabase.from("tasks").select("project_id").eq("id", taskId).is("deleted_at", null).maybeSingle();
  if (!task) throw new ApiError("NOT_FOUND", "Tarefa não encontrada");
  if (!(await userCanAccessProject(user, task.project_id))) throw new ApiError("FORBIDDEN", "Sem acesso a esta tarefa.");
}

/** Active workspaces only; ownership also grants access without a membership row. */
export async function getAccessibleWorkspaceIds(user:AuthUser):Promise<string[]> {
 const {data:members}=await supabase.from("workspace_members").select("workspace_id").eq("user_id",user.id);
 let query=supabase.from("workspaces").select("id").is("deleted_at",null);
 if(user.role!=="admin") {
  const ids=(members??[]).map(m=>m.workspace_id);
  query=query.or(`owner_id.eq.${user.id}${ids.length?`,id.in.(${ids.join(",")})`:""}`);
 }
 const {data}=await query;
 return (data??[]).map(w=>w.id);
}
