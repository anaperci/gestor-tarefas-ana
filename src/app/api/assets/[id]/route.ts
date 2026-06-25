import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, getAccessibleWorkspaceIds } from "@/lib/auth";
import { ApiError, withErrorHandling } from "@/lib/api-error";

export const DELETE = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);

    const { data: asset } = await supabase
      .from("asset_links")
      .select("workspace_id")
      .eq("id", id)
      .maybeSingle();
    if (!asset) throw new ApiError("NOT_FOUND", "Link não encontrado");

    // Assets globais (workspace_id null) qualquer autenticado remove; os de
    // workspace exigem membership (admin vê tudo)
    if (asset.workspace_id) {
      const accessible = await getAccessibleWorkspaceIds(user);
      if (accessible !== null && !accessible.includes(asset.workspace_id)) {
        throw new ApiError("FORBIDDEN", "Sem acesso a este workspace.");
      }
    }

    const { error } = await supabase.from("asset_links").delete().eq("id", id);
    if (error) {
      console.error("[assets.DELETE] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao remover link");
    }
    return NextResponse.json({ success: true });
  }
);
