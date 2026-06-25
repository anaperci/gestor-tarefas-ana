import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess, getAccessibleWorkspaceIds } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { createContentSchema, contentFormatEnum, contentStatusEnum, contentPlatformEnum } from "@/lib/content-schemas";
import { rowToItem, type ContentRow } from "@/lib/content";

const querySchema = z.object({
  status: z.array(contentStatusEnum).optional(),
  format: z.array(contentFormatEnum).optional(),
  platform: contentPlatformEnum.optional(),
  assignedTo: z.string().optional(),
  workspaceId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertContentAccess(user);

  const url = new URL(request.url);
  const params = querySchema.parse({
    status: url.searchParams.getAll("status"),
    format: url.searchParams.getAll("format"),
    platform: url.searchParams.get("platform") ?? undefined,
    assignedTo: url.searchParams.get("assignedTo") ?? undefined,
    workspaceId: url.searchParams.get("workspaceId") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  let query = supabase
    .from("content_items")
    .select("*")
    .is("deleted_at", null);

  if (params.status && params.status.length > 0) query = query.in("status", params.status);
  if (params.format && params.format.length > 0) query = query.in("format", params.format);
  if (params.platform) query = query.eq("platform", params.platform);
  if (params.assignedTo) query = query.eq("assigned_to", params.assignedTo);
  if (params.workspaceId) query = query.eq("workspace_id", params.workspaceId);

  // Isolamento: não-admin só enxerga conteúdo dos workspaces de que é membro
  const accessibleWs = await getAccessibleWorkspaceIds(user);
  if (accessibleWs !== null) {
    if (accessibleWs.length === 0) return NextResponse.json([]);
    query = query.in("workspace_id", accessibleWs);
  }
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,body.ilike.%${params.search}%,hook.ilike.%${params.search}%`);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (error) {
    console.error("[content.GET] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao listar conteúdos");
  }

  return NextResponse.json((data ?? []).map((r) => rowToItem(r as ContentRow)));
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertContentAccess(user);

  const body = await parseJson(request, createContentSchema);
  const id = "content-" + genId();

  const { error } = await supabase.from("content_items").insert({
    id,
    title: body.title ?? "",
    body: body.body ?? "",
    format: body.format ?? "post",
    status: "idea",
    workspace_id: body.workspaceId ?? null,
    created_by: user.id,
    last_edited_by: user.id,
  });

  if (error) {
    console.error("[content.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar conteúdo");
  }

  // Registra evento inicial no histórico
  await supabase.from("content_status_history").insert({
    id: "csh-" + genId(),
    content_item_id: id,
    changed_by: user.id,
    from_status: null,
    to_status: "idea",
  });

  const { data: created } = await supabase.from("content_items").select("*").eq("id", id).single();
  return NextResponse.json(rowToItem(created as ContentRow), { status: 201 });
});
