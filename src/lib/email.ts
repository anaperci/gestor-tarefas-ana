/**
 * Integração de email transacional via Brevo (https://www.brevo.com).
 *
 * Env vars (Vercel / .env.local):
 *   BREVO_API_KEY        — chave da API Brevo (obrigatória para enviar)
 *   BREVO_SENDER_EMAIL   — email remetente verificado na Brevo
 *   BREVO_SENDER_NAME    — nome do remetente (default "Clareza")
 *   NEXT_PUBLIC_APP_URL  — base da app, p/ montar links (ex: https://gestor-tarefas-ana.vercel.app)
 *
 * Se BREVO_API_KEY não estiver configurada, os envios são apenas logados
 * (modo dev) e não quebram o fluxo.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}

export function isEmailConfigured(): boolean {
  return !!process.env.BREVO_API_KEY && !!process.env.BREVO_SENDER_EMAIL;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Envia um email via Brevo. Lança Error em falha de envio quando configurado;
 * em modo não-configurado (dev), apenas loga e retorna sem erro.
 */
export async function sendEmail({ to, toName, subject, html }: SendEmailParams): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(`[email] Brevo não configurado — email para ${to} NÃO enviado. Assunto: "${subject}"`);
    return;
  }

  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY as string,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME || "Clareza",
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[email] Brevo falhou (${res.status}):`, detail);
    throw new Error("Falha ao enviar email");
  }
}

// ── Templates ────────────────────────────────────────────────────────

const BRAND = "#0F4C5C";

function layout(title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `
  <div style="background:#f4f6fb;padding:32px 0;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ece9f5;">
      <div style="background:${BRAND};padding:24px 32px;">
        <span style="color:#F4EFE2;font-family:'Marcellus',Georgia,serif;font-size:24px;letter-spacing:3px;">CLAREZA</span>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#1a1430;">${title}</h1>
        <div style="font-size:15px;line-height:1.6;color:#4a4458;">${bodyHtml}</div>
        <a href="${ctaUrl}" style="display:inline-block;margin-top:24px;background:${BRAND};color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">${ctaLabel}</a>
        <p style="margin-top:24px;font-size:12px;color:#8a8499;line-height:1.5;">
          Se o botão não funcionar, copie e cole este link no navegador:<br>
          <span style="word-break:break-all;color:${BRAND};">${ctaUrl}</span>
        </p>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #ece9f5;font-size:12px;color:#a8a3b5;">
        Clareza · Gestão de tarefas
      </div>
    </div>
  </div>`;
}

export function passwordResetEmail(name: string, link: string): { subject: string; html: string } {
  return {
    subject: "Redefinição de senha — Clareza",
    html: layout(
      "Redefinir sua senha",
      `Olá, ${name}.<br><br>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para escolher uma nova. <strong>O link expira em 1 hora.</strong><br><br>Se não foi você, ignore este email — sua senha continua a mesma.`,
      "Redefinir senha",
      link
    ),
  };
}

export function welcomeAccessEmail(name: string, link: string): { subject: string; html: string } {
  return {
    subject: "Seu acesso ao Clareza",
    html: layout(
      "Bem-vindo(a) ao Clareza",
      `Olá, ${name}.<br><br>Foi criado um acesso para você no Clareza. Clique no botão abaixo para definir sua senha e entrar. <strong>O link expira em 48 horas.</strong>`,
      "Definir minha senha",
      link
    ),
  };
}
