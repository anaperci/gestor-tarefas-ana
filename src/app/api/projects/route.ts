import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { genId } from "@/lib/utils";
import { colorSchema, emojiSchema, titleSchema } from "@/lib/validation";

const createProjectSchema = z.object({
  name: titleSchema,
  color: colorSchema.optional(),
  icon: emojiSchema.optional(),
  workspaceId: z.string().min(1).max(64).optional(),
});

interface ProjectRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  owner_id: string;
  workspace_id: string | null;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  let projects: ProjectRow[];
  if (user.role === "admin") {
    const { data } = await supabase
      .from("projects")
      .select("id, name, color, icon, owner_id, workspace_id")
      .is("deleted_at", null)
      .order("created_at");
    projects = (data ?? []) as ProjectRow[];
  } else {
    // RPC já filtra deleted_at desde a sprint-1 SQL migration
    const { data } = await supabase.rpc("get_user_projects", { p_user_id: user.id });
    projects = (data ?? []) as ProjectRow[];
  }

  // FASE2.3a — eliminar N+1: 1 query agrega todos os shares, depois Map em memória
  const projectIds = projects.map((p) => p.id);
  const sharesByProject = new Map<string, string[]>();

  if (projectIds.length > 0) {
    const { data: shares } = await supabase
      .from("project_shares")
      .select("project_id, user_id")
      .in("project_id", projectIds);
    for (const row of shares ?? []) {
      const list = sharesByProject.get(row.project_id) ?? [];
      list.push(row.user_id);
      sharesByProject.set(row.project_id, list);
    }
  }

  const result = projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    icon: p.icon,
    ownerId: p.owner_id,
    workspaceId: p.workspace_id ?? null,
    sharedWith: sharesByProject.get(p.id) ?? [],
  }));

  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertEditorOrAdmin(user);

  const { name, color, icon, workspaceId } = await parseJson(request, createProjectSchema);

  // Resolve o workspace destino: o informado, ou o "Geral" como padrão.
  let targetWorkspaceId = workspaceId ?? null;
  if (!targetWorkspaceId) {
    const { data: geral } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", "ws-geral")
      .is("deleted_at", null)
      .maybeSingle();
    targetWorkspaceId = geral?.id ?? null;
  }

  // Valida workspace e permissão (admin pode em qualquer um; gestor só no dele)
  if (targetWorkspaceId) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", targetWorkspaceId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!ws) throw new ApiError("NOT_FOUND", "Workspace não encontrado");
    if (user.role !== "admin" && ws.owner_id !== user.id) {
      throw new ApiError("FORBIDDEN", "Você não pode criar projeto neste workspace.");
    }
  } else if (user.role !== "admin") {
    throw new ApiError("VALIDATION_ERROR", "Selecione um workspace.");
  }

  const id = "proj-" + genId();
  const finalColor = color || "#7B61FF";
  const finalIcon = icon || "📌";

  const { error } = await supabase.from("projects").insert({
    id,
    name,
    color: finalColor,
    icon: finalIcon,
    owner_id: user.id,
    workspace_id: targetWorkspaceId,
  });

  if (error) {
    console.error("[projects.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar projeto");
  }

  await audit({
    action: "project.create",
    resource: "projects",
    resourceId: id,
    actorId: user.id,
    actorRole: user.role,
    metadata: { name, workspaceId: targetWorkspaceId },
    request,
  });

  return NextResponse.json(
    {
      id,
      name,
      color: finalColor,
      icon: finalIcon,
      ownerId: user.id,
      workspaceId: targetWorkspaceId,
      sharedWith: [],
    },
    { status: 201 }
  );
});
