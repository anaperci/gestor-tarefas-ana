/**
 * Helpers do fluxo de redefinição de senha ("esqueci minha senha").
 *
 * Segurança: o token bruto vai SÓ no link do email; no banco guardamos apenas
 * o hash SHA-256. Tokens são de uso único e expiram em 1h.
 */
import crypto from "crypto";

/** Tempo de vida do link de redefinição. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
export const RESET_TOKEN_TTL_MIN = RESET_TOKEN_TTL_MS / 60_000;

/**
 * Valor da coluna `purpose` na tabela password_reset_tokens. A tabela é
 * compartilhada por propósito — todas as queries de reset filtram por isto.
 */
export const RESET_PURPOSE = "password_reset";

const BRAND = "Ordum";
const BRAND_COLOR = "#7B61FF";

/** Gera o token bruto (vai no link) e seu hash (vai no banco). */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

/**
 * Hash determinístico do token. Guardamos só o hash, nunca o token bruto.
 * Usa HMAC-SHA256 com o JWT_SECRET quando disponível (defesa extra caso o
 * banco vaze); cai pra SHA-256 puro em ambientes sem segredo (dev). O token
 * bruto tem 256 bits de entropia, então buscar por hash já é inviável.
 */
export function hashResetToken(raw: string): string {
  const secret = process.env.JWT_SECRET;
  const h = secret ? crypto.createHmac("sha256", secret) : crypto.createHash("sha256");
  return h.update(raw).digest("hex");
}

/** Descobre a URL base pública a partir da request (respeita proxy da Vercel). */
export function baseUrlFromRequest(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  return new URL(request.url).origin;
}

/** Monta a URL absoluta do link de redefinição. */
export function buildResetUrl(baseUrl: string, rawToken: string): string {
  const u = new URL("/reset-password", baseUrl);
  u.searchParams.set("token", rawToken);
  return u.toString();
}

interface ResetEmailParts {
  name: string;
  resetUrl: string;
  ttlMinutes?: number;
}

/** Corpo HTML do email de redefinição. */
export function resetEmailHtml({ name, resetUrl, ttlMinutes = RESET_TOKEN_TTL_MIN }: ResetEmailParts): string {
  const safeName = escapeHtml(name || "");
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f4f3f8;font-family:Helvetica,Arial,sans-serif;color:#1f2430;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f8;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(70,52,127,0.10);">
          <tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
            <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${BRAND}</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1f2430;">Redefinição de senha</h1>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#444b59;">${greeting}</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444b59;">
              Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr><td style="border-radius:10px;background:${BRAND_COLOR};">
                <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Redefinir senha</a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#7a8194;">
              Este link expira em ${ttlMinutes} minutos e só pode ser usado uma vez.
            </p>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#7a8194;">
              Se você não pediu isso, pode ignorar este email — sua senha continua a mesma.
            </p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#9aa0b0;word-break:break-all;">
              Se o botão não funcionar, copie e cole no navegador:<br>${escapeHtml(resetUrl)}
            </p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#9aa0b0;">${BRAND} — Gestor de Tarefas</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Versão texto-puro do email de redefinição. */
export function resetEmailText({ name, resetUrl, ttlMinutes = RESET_TOKEN_TTL_MIN }: ResetEmailParts): string {
  const safeName = (name || "").replace(/[\r\n]/g, " ").trim();
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  return [
    `${greeting}`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta no Ordum.",
    "Abra o link abaixo para escolher uma nova senha:",
    "",
    resetUrl,
    "",
    `Este link expira em ${ttlMinutes} minutos e só pode ser usado uma vez.`,
    "Se você não pediu isso, ignore este email — sua senha continua a mesma.",
    "",
    "Ordum — Gestor de Tarefas",
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
