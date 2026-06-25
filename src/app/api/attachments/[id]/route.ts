import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertTaskAccess } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";

const BUCKET = "task-attachments";

// Gera link assinado temporário (1h) pra abrir/baixar o anexo
export const GET = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const { data: att } = await supabase
      .from("task_attachments")
      .select("storage_path, file_name, task_id")
      .eq("id", id)
      .maybeSingle();
    if (!att) throw new ApiError("NOT_FOUND", "Anexo não encontrado");
    await assertTaskAccess(user, att.task_id);

    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(att.storage_path, 3600);
    if (error || !signed) {
      console.error("[attachments.GET] signed url failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao gerar link");
    }

    return NextResponse.json({ url: signed.signedUrl, fileName: att.file_name });
  }
);

// Remove o anexo (arquivo + metadado) — qualquer usuário autenticado
export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const { data: att } = await supabase
      .from("task_attachments")
      .select("storage_path, task_id")
      .eq("id", id)
      .maybeSingle();
    if (!att) throw new ApiError("NOT_FOUND", "Anexo não encontrado");
    await assertTaskAccess(user, att.task_id);

    await supabase.storage.from(BUCKET).remove([att.storage_path]);
    const { error } = await supabase.from("task_attachments").delete().eq("id", id);
    if (error) {
      console.error("[attachments.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover anexo");
    }

    return NextResponse.json({ success: true });
  }
);
