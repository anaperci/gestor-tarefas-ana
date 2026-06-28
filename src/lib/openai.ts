/**
 * Resumo de transcrições via OpenAI (GPT).
 * Env: OPENAI_API_KEY (obrigatória). Modelo: OPENAI_MODEL ou gpt-4o-mini.
 */
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function summarizeTranscript(content: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  // Limita o tamanho enviado (proteção de custo/limite)
  const text = content.slice(0, 48000);

  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Você resume transcrições de reuniões em português do Brasil. Seja objetivo e estruture em: **Resumo** (2-4 linhas), **Decisões**, **Pendências / Próximos passos** (com responsável quando houver). Use markdown enxuto. Se não houver informação para uma seção, omita-a.",
        },
        { role: "user", content: `Resuma esta transcrição:\n\n${text}` },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[openai] falhou (${res.status}):`, detail);
    throw new Error("Falha ao gerar resumo");
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── Notas de voz ──────────────────────────────────────────────────────

const OPENAI_TRANSCRIBE = "https://api.openai.com/v1/audio/transcriptions";

/** Transcreve áudio via Whisper (OpenAI). */
export async function transcribeAudio(file: File): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada");

  const form = new FormData();
  form.append("file", file, file.name || "audio.webm");
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  form.append("language", "pt");

  const res = await fetch(OPENAI_TRANSCRIBE, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[openai.transcribe] falhou (${res.status}):`, detail);
    throw new Error("Falha ao transcrever áudio");
  }
  const data = await res.json();
  return (data.text || "").trim();
}

export interface VoiceTaskSuggestion {
  title: string;
  projectId: string | null;
  dueDate: string | null;   // YYYY-MM-DD
  priority: "low" | "medium" | "high" | null;
}
export interface VoiceNoteSuggestion {
  title: string;
  body: string;
}
export interface VoiceStructured {
  tasks: VoiceTaskSuggestion[];
  notes: VoiceNoteSuggestion[];
}

/**
 * Estrutura uma transcrição em tarefas + notas via GPT (JSON).
 * `projects` é a lista de projetos disponíveis p/ a IA sugerir o projectId.
 */
export async function structureVoiceNote(
  text: string,
  projects: { id: string; name: string }[],
  todayISO: string
): Promise<VoiceStructured> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const projectList = projects.map((p) => `- ${p.id}: ${p.name}`).join("\n") || "(nenhum)";

  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Você organiza um despejo de voz (pt-BR) em itens acionáveis. Hoje é ${todayISO}.\n` +
            `Separe em TAREFAS (ações a fazer) e NOTAS (ideias, registros, informações sem ação).\n` +
            `Para cada TAREFA: title (curto e claro), projectId (escolha um id da lista de projetos pelo conteúdo, ou null se incerto), dueDate (YYYY-MM-DD se a pessoa mencionar prazo/data relativa como "sexta", "amanhã"; senão null), priority ("low"|"medium"|"high" se der pra inferir urgência; senão null).\n` +
            `Para cada NOTA: title (curto) e body (o conteúdo).\n` +
            `Projetos disponíveis:\n${projectList}\n\n` +
            `Responda SOMENTE com JSON: {"tasks":[{"title","projectId","dueDate","priority"}],"notes":[{"title","body"}]}. Não invente itens que não estão no áudio.`,
        },
        { role: "user", content: text.slice(0, 16000) },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[openai.structure] falhou (${res.status}):`, detail);
    throw new Error("Falha ao interpretar a nota de voz");
  }
  const data = await res.json();
  let parsed: VoiceStructured = { tasks: [], notes: [] };
  try {
    const obj = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    parsed = {
      tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
      notes: Array.isArray(obj.notes) ? obj.notes : [],
    };
  } catch { /* mantém vazio */ }
  // valida projectId contra a lista
  const validIds = new Set(projects.map((p) => p.id));
  parsed.tasks = parsed.tasks.map((t) => ({
    title: String(t.title || "").slice(0, 200),
    projectId: t.projectId && validIds.has(t.projectId) ? t.projectId : null,
    dueDate: typeof t.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : null,
    priority: ["low", "medium", "high"].includes(t.priority as string) ? t.priority : null,
  })).filter((t) => t.title);
  parsed.notes = parsed.notes.map((n) => ({
    title: String(n.title || "").slice(0, 200),
    body: String(n.body || "").slice(0, 5000),
  })).filter((n) => n.title || n.body);
  return parsed;
}
