import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertAdmin(user);

    // FASE1.7 — validar ownership: admin só pode deletar projeto próprio
    // (Sistema só admite admin único por ora, mas isso bloqueia qualquer
    // admin futuro de apagar projeto alheio sem trilha de auditoria.)
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", id)
      .maybeSingle();

    if (!project) throw new ApiError("NOT_FOUND", "Projeto não encontrado");
    if (project.owner_id !== user.id) {
      throw new ApiError("FORBIDDEN", "Só o dono do projeto pode removê-lo");
    }

    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      console.error("[projects.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover projeto");
    }
    return NextResponse.json({ success: true });
  }
);
