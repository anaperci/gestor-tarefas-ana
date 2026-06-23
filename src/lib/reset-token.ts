import crypto from "crypto";
import { supabase } from "./supabase";
import { genId } from "./utils";
import { appUrl, sendEmail, passwordResetEmail, welcomeAccessEmail } from "./email";

export type TokenPurpose = "reset" | "welcome";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const EXPIRY_HOURS: Record<TokenPurpose, number> = { reset: 1, welcome: 48 };

/**
 * Gera um token de uso único, salva o HASH no banco e devolve o token em claro
 * (só ele serve para montar o link — o banco nunca vê o valor real).
 */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS[purpose] * 60 * 60 * 1000).toISOString();

  // Invalida tokens anteriores não usados do mesmo propósito
  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("used_at", null);

  await supabase.from("password_reset_tokens").insert({
    id: "prt-" + genId(),
    user_id: userId,
    token_hash: hashToken(raw),
    purpose,
    expires_at: expiresAt,
  });

  return raw;
}

/**
 * Valida um token em claro. Retorna o user_id se válido, ou null.
 * Não marca como usado — isso é feito após a troca de senha bem-sucedida.
 */
export async function verifyToken(raw: string): Promise<{ id: string; userId: string } | null> {
  const { data } = await supabase
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", hashToken(raw))
    .maybeSingle();

  if (!data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  return { id: data.id, userId: data.user_id };
}

export async function consumeToken(tokenId: string): Promise<void> {
  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId);
}

/**
 * Emite token + envia o email correspondente. Usado por forgot-password,
 * reset disparado pelo admin e email de acesso na criação de usuário.
 */
export async function sendAccessEmail(
  user: { id: string; name: string; email: string },
  purpose: TokenPurpose
): Promise<void> {
  const raw = await issueToken(user.id, purpose);
  const link = `${appUrl()}/reset-password?token=${raw}`;
  const tpl = purpose === "welcome"
    ? welcomeAccessEmail(user.name, link)
    : passwordResetEmail(user.name, link);
  await sendEmail({ to: user.email, toName: user.name, subject: tpl.subject, html: tpl.html });
}
