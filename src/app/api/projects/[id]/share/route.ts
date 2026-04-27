import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { idSchema, MAX_PROJECT_SHARES } from "@/lib/validation";

const shareSchema = z.object({
  sharedWith: z.array(idSchema).max(MAX_PROJECT_SHARES),
});

export const PUT = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    const { sharedWith } = await parseJson(request, shareSchema);

    // Garante que projeto existe (e não está soft-deleted)
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!project) throw new ApiError("NOT_FOUND", "Projeto não encontrado");

    // Valida que todos os user IDs existem e estão ativos
    if (sharedWith.length > 0) {
      const { data: validUsers } = await supabase
        .from("users")
        .select("id")
        .in("id", sharedWith)
        .is("deleted_at", null);
      const validIds = new Set((validUsers ?? []).map((u) => u.id));
      const invalid = sharedWith.filter((uid) => !validIds.has(uid));
      if (invalid.length > 0) {
        throw new ApiError("VALIDATION_ERROR", "Usuário(s) inválido(s)", { invalid });
      }
    }

    await supabase.from("project_shares").delete().eq("project_id", id);

    if (sharedWith.length > 0) {
      const { error } = await supabase
        .from("project_shares")
        .insert(sharedWith.map((userId) => ({ project_id: id, user_id: userId })));
      if (error) {
        console.error("[projects.share.PUT] insert failed:", error);
        throw new ApiError("INTERNAL_ERROR", "Falha ao salvar compartilhamentos");
      }
    }

    await audit({
      action: "project.share",
      resource: "projects",
      resourceId: id,
      actorId: user.id,
      actorRole: user.role,
      metadata: { sharedWith },
      request,
    });

    return NextResponse.json({ success: true, sharedWith });
  }
);
