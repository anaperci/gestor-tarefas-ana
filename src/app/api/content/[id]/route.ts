import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { updateContentSchema } from "@/lib/content-schemas";
import { rowToItem, payloadToDbColumns, type ContentRow } from "@/lib/content";

export const GET = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { data } = await supabase
      .from("content_items")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!data) throw new ApiError("NOT_FOUND", "Conteúdo não encontrado");
    return NextResponse.json(rowToItem(data as ContentRow));
  }
);

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { data: current } = await supabase
      .from("content_items")
      .select("status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!current) throw new ApiError("NOT_FOUND", "Conteúdo não encontrado");

    const body = await parseJson(request, updateContentSchema);
    const updates = payloadToDbColumns(body as Record<string, unknown>);
    updates.updated_at = new Date().toISOString();
    updates.last_edited_by = user.id;

    // Auto-set published_at se status virou 'published'
    if (body.status === "published" && current.status !== "published") {
      updates.published_at = new Date().toISOString();
    }

    const { error } = await supabase.from("content_items").update(updates).eq("id", id);
    if (error) {
      console.error("[content.PUT] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao atualizar conteúdo");
    }

    // Registra mudança de status
    if (body.status && body.status !== current.status) {
      await supabase.from("content_status_history").insert({
        id: "csh-" + genId(),
        content_item_id: id,
        changed_by: user.id,
        from_status: current.status,
        to_status: body.status,
      });
    }

    const { data: updated } = await supabase.from("content_items").select("*").eq("id", id).single();
    return NextResponse.json(rowToItem(updated as ContentRow));
  }
);

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { error } = await supabase
      .from("content_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("[content.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover conteúdo");
    }
    return NextResponse.json({ success: true });
  }
);
