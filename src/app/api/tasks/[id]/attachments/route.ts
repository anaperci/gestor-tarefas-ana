import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertTaskAccess } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";

const BUCKET = "task-attachments";
const MAX_BYTES = 52428800; // 50 MB

interface AttachmentRow {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

function rowToAttachment(r: AttachmentRow) {
  return {
    id: r.id,
    taskId: r.task_id,
    uploadedBy: r.uploaded_by,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  };
}

export const GET = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    await assertTaskAccess(user, id);

    const { data } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json((data ?? []).map((r) => rowToAttachment(r as AttachmentRow)));
  }
);

export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    await assertTaskAccess(user, id);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", "Arquivo ausente");
    if (file.size === 0) throw new ApiError("VALIDATION_ERROR", "Arquivo vazio");
    if (file.size > MAX_BYTES) throw new ApiError("VALIDATION_ERROR", "Arquivo acima de 50 MB");

    const attId = "att-" + genId();
    const safe = (file.name || "arquivo").replace(/[^\w.\-]+/g, "_").slice(-120) || "arquivo";
    const path = `${id}/${attId}-${safe}`;
    const buf = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) {
      console.error("[attachments.POST] upload failed:", upErr);
      throw new ApiError("INTERNAL_ERROR", "Falha ao enviar arquivo");
    }

    const { error: insErr } = await supabase.from("task_attachments").insert({
      id: attId,
      task_id: id,
      uploaded_by: user.id,
      file_name: file.name || safe,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
    });
    if (insErr) {
      // rollback do arquivo se o metadado falhar
      await supabase.storage.from(BUCKET).remove([path]);
      console.error("[attachments.POST] insert failed:", insErr);
      throw new ApiError("INTERNAL_ERROR", "Falha ao registrar anexo");
    }

    const { data } = await supabase.from("task_attachments").select("*").eq("id", attId).single();
    return NextResponse.json(rowToAttachment(data as AttachmentRow), { status: 201 });
  }
);
