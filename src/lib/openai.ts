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
