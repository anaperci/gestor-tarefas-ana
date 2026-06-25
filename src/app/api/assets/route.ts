import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, getAccessibleWorkspaceIds, type AuthUser } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";

interface AssetRow {
  id: string;
  workspace_id: string | null;
  title: string;
  url: string;
  description: string | null;
  created_at: string;
}

function rowToAsset(r: AssetRow) {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    title: r.title,
    url: r.url,
    description: r.description,
    createdAt: r.created_at,
  };
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(160),
  url: z.string().min(1).max(2000),
  description: z.string().max(500).optional(),
});

async function assertWorkspaceMember(user: AuthUser, workspaceId: string) {
  const accessible = await getAccessibleWorkspaceIds(user);
  if (accessible === null) return; // admin
  if (!accessible.includes(workspaceId)) {
    throw new ApiError("FORBIDDEN", "Sem acesso a este workspace.");
  }
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) throw new ApiError("VALIDATION_ERROR", "workspaceId obrigatório");
  await assertWorkspaceMember(user, workspaceId);

  const { data } = await supabase
    .from("asset_links")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return NextResponse.json((data ?? []).map((r) => rowToAsset(r as AssetRow)));
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const body = await parseJson(request, createSchema);
  await assertWorkspaceMember(user, body.workspaceId);

  const id = "asset-" + genId();
  const { error } = await supabase.from("asset_links").insert({
    id,
    workspace_id: body.workspaceId,
    title: body.title.trim(),
    url: body.url.trim(),
    description: body.description?.trim() || null,
    created_by: user.id,
  });
  if (error) {
    console.error("[assets.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao salvar link");
  }

  const { data } = await supabase.from("asset_links").select("*").eq("id", id).single();
  return NextResponse.json(rowToAsset(data as AssetRow), { status: 201 });
});
