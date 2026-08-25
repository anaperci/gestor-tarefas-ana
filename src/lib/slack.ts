import { supabase } from "./supabase";

/** Configurado? Sem webhook, o sistema segue normal e nada é enviado. */
export function isSlackConfigured(): boolean {
  return !!process.env.SLACK_WEBHOOK_URL;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

/** URL pública da tarefa — abre o painel dela direto. */
export function taskUrl(taskId: string): string {
  return `${appUrl()}/?tarefa=${encodeURIComponent(taskId)}`;
}

const PRIORIDADES: Record<string, string> = {
  critical: "🔴 Crítica",
  high: "🟠 Alta",
  medium: "🟡 Média",
  low: "🟢 Baixa",
};

function formatarData(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

interface TarefaCriada {
  id: string;
  title: string;
  priority: string;
  deadline: string;
  projectId: string;
  assignedTo: string | null;
  autorNome: string;
}

/**
 * Avisa no canal do Slack que uma tarefa foi criada, com o link embutido
 * no próprio título. Nunca lança: falha de Slack não pode derrubar a
 * criação da tarefa — só vira log.
 */
export async function notificarTarefaCriada(t: TarefaCriada): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  // O quick-add cria linhas vazias "Nova tarefa" que só ganham nome depois —
  // avisar o canal a cada uma delas seria puro ruído.
  if (t.title.trim().toLowerCase() === "nova tarefa") return;

  try {
    const [{ data: projeto }, { data: responsavel }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", t.projectId).maybeSingle(),
      t.assignedTo
        ? supabase.from("users").select("name").eq("id", t.assignedTo).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const campos = [
      `*Grupo:* ${projeto?.name ?? "—"}`,
      `*Responsável:* ${responsavel?.name ?? "—"}`,
      `*Prioridade:* ${PRIORIDADES[t.priority] ?? t.priority}`,
    ];
    if (t.deadline) campos.push(`*Prazo:* ${formatarData(t.deadline)}`);

    const url = taskUrl(t.id);
    const payload = {
      text: `Nova tarefa: ${t.title}`, // fallback (notificação do celular)
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*<${url}|${t.title}>*` },
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `${campos.join("  ·  ")}  ·  criada por ${t.autorNome}` }],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Abrir tarefa" },
              url,
              style: "primary",
            },
          ],
        },
      ],
    };

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[slack] webhook respondeu", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[slack] falha ao notificar:", err);
  }
}
