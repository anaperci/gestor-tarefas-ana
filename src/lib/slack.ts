import {isCreationGroup,sendSlack} from "./slack-delivery";
import { supabase } from "./supabase";

/** Legacy project connections; Creation groups use the global durable outbox. */
async function webhookDoProjeto(projectId: string): Promise<{ url: string; canal: string } | null> {
  const { data } = await supabase
    .from("slack_channels")
    .select("webhook_url, canal_nome")
    .eq("project_id", projectId)
    .maybeSingle();
  const url = data?.webhook_url || process.env.SLACK_WEBHOOK_URL || "";
  if (!url) return null;
  return { url, canal: (data?.canal_nome || "").replace(/^#/, "").trim() };
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

/** URL pública da tarefa — abre o painel dela direto. */
export function taskUrl(taskId: string): string {
  return `${appUrl()}/?tarefa=${encodeURIComponent(taskId)}`;
}

const PRIORIDADES: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
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
  groupId?: string | null;
}

/**
 * Avisa no canal do Slack que uma tarefa foi criada, com o link embutido
 * no próprio título. Nunca lança: falha de Slack não pode derrubar a
 * criação da tarefa — só vira log.
 */
export async function notificarTarefaCriada(t: TarefaCriada): Promise<void> {
  // O quick-add cria linhas vazias "Nova tarefa" que só ganham nome depois —
  // avisar o canal a cada uma delas seria puro ruído.
  if (t.title.trim().toLowerCase() === "nova tarefa") return;

  try {
    // Creation groups are delivered by the durable database outbox, never twice here.
    if(t.groupId){const {data:g}=await supabase.from("task_groups").select("name").eq("id",t.groupId).maybeSingle();if(g&&isCreationGroup(g.name))return;}
    const webhook = await webhookDoProjeto(t.projectId);
    if (!webhook) return;

    const [{ data: projeto }, { data: responsavel }] = await Promise.all([
      supabase.from("projects").select("name").eq("id", t.projectId).maybeSingle(),
      t.assignedTo
        ? supabase.from("users").select("name").eq("id", t.assignedTo).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const url = taskUrl(t.id);
    const setor = webhook.canal || projeto?.name || "";
    const abertura = setor
      ? `Tem uma nova tarefa de ${setor} liberada.`
      : "Tem uma nova tarefa liberada.";

    const linhas = [
      "Oi time,",
      "",
      abertura,
      "",
      `*Tarefa:* <${url}|${t.title}>`,
      `*Responsável:* ${responsavel?.name ?? "—"}`,
      `*Urgência:* ${PRIORIDADES[t.priority] ?? t.priority}`,
    ];
    if (t.deadline) linhas.push(`*Prazo:* ${formatarData(t.deadline)}`);

    const payload = {
      text: `Nova tarefa: ${t.title}`, // fallback da notificação do celular
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: linhas.join("\n") } },
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

    const result=await sendSlack(webhook.url,payload);
    if(!result.ok) console.error("[slack]",result.error);
  } catch (err) {
    console.error("[slack] falha ao notificar:", err);
  }
}
