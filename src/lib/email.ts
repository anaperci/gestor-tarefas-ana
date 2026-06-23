/**
 * Envio de email transacional via Brevo (https://developers.brevo.com).
 *
 * Wrapper genérico e reutilizável — use `sendEmail()` em qualquer feature
 * (redefinição de senha, convites, notificações, etc.). O remetente é lido
 * das envs `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME`, e a autenticação da
 * `BREVO_API_KEY`. Nada de SDK extra: só `fetch` (leve em runtime serverless).
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface SendEmailParams {
  to: string | EmailAddress | Array<string | EmailAddress>;
  subject: string;
  html: string;
  /** Versão texto-puro (fallback de clientes sem HTML). Opcional mas recomendado. */
  text?: string;
  replyTo?: EmailAddress;
  /** Tags de rastreamento no painel do Brevo. */
  tags?: string[];
}

export interface SendEmailResult {
  messageId: string;
}

function normalizeRecipients(to: SendEmailParams["to"]): EmailAddress[] {
  const arr = Array.isArray(to) ? to : [to];
  return arr.map((r) => (typeof r === "string" ? { email: r } : r));
}

/** True se as envs mínimas pra enviar email estão presentes. */
export function isEmailConfigured(): boolean {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

/**
 * Envia um email transacional. Lança `Error` (com log) em qualquer falha —
 * cabe ao chamador decidir se a falha de envio deve ou não quebrar o fluxo.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Ordum";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "Brevo não configurado: defina BREVO_API_KEY e BREVO_SENDER_EMAIL nas variáveis de ambiente."
    );
  }

  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: normalizeRecipients(params.to),
    subject: params.subject,
    htmlContent: params.html,
    ...(params.text ? { textContent: params.text } : {}),
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(params.tags ? { tags: params.tags } : {}),
  };

  // Timeout defensivo — evita pendurar a função serverless se o Brevo travar.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("[email] erro de rede/timeout ao chamar o Brevo:", err);
    throw new Error("Falha de rede ao enviar email");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[email] Brevo respondeu ${res.status}:`, detail);
    throw new Error(`Brevo retornou ${res.status} ao enviar email`);
  }

  const data = (await res.json().catch(() => ({}))) as { messageId?: string };
  return { messageId: data.messageId ?? "" };
}
