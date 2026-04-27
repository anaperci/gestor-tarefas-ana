import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { genId } from "@/lib/utils";
import { colorSchema, emojiSchema, titleSchema } from "@/lib/validation";

const createProjectSchema = z.object({
  name: titleSchema,
  color: colorSchema.optional(),
  icon: emojiSchema.optional(),
});

interface ProjectRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  owner_id: string;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  let projects: ProjectRow[];
  if (user.role === "admin") {
    const { data } = await supabase
      .from("projects")
      .select("id, name, color, icon, owner_id")
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
    sharedWith: sharesByProject.get(p.id) ?? [],
  }));

  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertAdmin(user);

  const { name, color, icon } = await parseJson(request, createProjectSchema);

  const id = "proj-" + genId();
  const finalColor = color || "#7B61FF";
  const finalIcon = icon || "📌";

  const { error } = await supabase.from("projects").insert({
    id,
    name,
    color: finalColor,
    icon: finalIcon,
    owner_id: user.id,
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
    metadata: { name },
    request,
  });

  return NextResponse.json(
    { id, name, color: finalColor, icon: finalIcon, ownerId: user.id, sharedWith: [] },
    { status: 201 }
  );
});
