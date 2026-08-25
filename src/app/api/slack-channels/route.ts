import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";

const payloadSchema = z.object({
  projectId: z.string().min(1).max(64),
  webhookUrl: z
    .string()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/hooks\.slack\.com\/services\/\S+$/.test(v), {
      message: "Deve ser um Incoming Webhook do Slack (https://hooks.slack.com/services/...)",
    }),
  canalNome: z.string().max(80).optional(),
});

/** GET — quais grupos já notificam, e em que canal. A URL nunca sai daqui. */
export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertAdmin(user);

  const { data } = await supabase
    .from("slack_channels")
    .select("project_id, canal_nome, webhook_url");

  return NextResponse.json(
    (data ?? []).map((r) => ({
      projectId: r.project_id,
      canalNome: r.canal_nome ?? "",
      configurado: !!r.webhook_url,
    }))
  );
});

/** PUT — define (ou limpa, com webhookUrl vazio) o canal de um grupo. */
export const PUT = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertAdmin(user);

  const { projectId, webhookUrl, canalNome } = await parseJson(request, payloadSchema);

  const { data: projeto } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!projeto) throw new ApiError("NOT_FOUND", "Grupo não encontrado");

  if (!webhookUrl) {
    await supabase.from("slack_channels").delete().eq("project_id", projectId);
    return NextResponse.json({ success: true, configurado: false });
  }

  const { error } = await supabase.from("slack_channels").upsert({
    project_id: projectId,
    webhook_url: webhookUrl,
    canal_nome: canalNome?.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[slack-channels.PUT] falhou:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao salvar canal");
  }

  return NextResponse.json({ success: true, configurado: true });
});
