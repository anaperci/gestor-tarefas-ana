import { visibleProjectRows, allRows } from "@/lib/collections";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { genId } from "@/lib/utils";
import { colorSchema, idSchema, titleSchema } from "@/lib/validation";
import { userCanAccessProject } from "@/lib/access";

const createSchema = z.object({
  projectId: idSchema,
  name: titleSchema,
  color: colorSchema.optional(),
});

interface GroupRow {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
}

/** Lista os grupos de todos os projetos — o filtro por projeto é feito no cliente. */
export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  const projects = await visibleProjectRows(user.id);
  if (!projects.length) return NextResponse.json([]);

  const data = await allRows<GroupRow>((a,b) => supabase.from("task_groups")
    .select("id, project_id, name, color, position").in("project_id", projects.map(p=>p.id))
    .is("deleted_at", null).order("position").order("id").range(a,b));

  const result = ((data ?? []) as GroupRow[]).map((g) => ({
    id: g.id,
    projectId: g.project_id,
    name: g.name,
    color: g.color,
    position: g.position,
  }));

  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertEditorOrAdmin(user);

  const { projectId, name, color } = await parseJson(request, createSchema);

  const hasAccess = await userCanAccessProject(user, projectId);
  if (!hasAccess) throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");

  // Novo grupo entra no fim da lista do projeto.
  const { data: last } = await supabase
    .from("task_groups")
    .select("position")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const colors = ["#0F4C5C", "#15708C", "#E07A52", "#00C875", "#FDAB3D", "#579BFC", "#FF78CB", "#1ABC9C"];
  const finalColor = color || colors[Math.floor(Math.random() * colors.length)];
  const id = "tg-" + genId();
  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("task_groups").insert({
    id,
    project_id: projectId,
    name,
    color: finalColor,
    position,
  });

  if (error) {
    console.error("[task-groups.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar grupo");
  }

  await audit({
    action: "task_group.create",
    resource: "task_groups",
    resourceId: id,
    actorId: user.id,
    actorRole: user.role,
    metadata: { name, projectId },
    request,
  });

  return NextResponse.json({ id, projectId, name, color: finalColor, position }, { status: 201 });
});

/** Reordenação em lote — recebe os ids na ordem final. */
const reorderSchema = z.object({
  projectId: idSchema,
  ids: z.array(idSchema).max(100),
});

export const PATCH = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertEditorOrAdmin(user);

  const { projectId, ids } = await parseJson(request, reorderSchema);

  const hasAccess = await userCanAccessProject(user, projectId);
  if (!hasAccess) throw new ApiError("FORBIDDEN", "Sem acesso ao projeto");

  await supabase.rpc("reorder_task_groups", { p_project_id: projectId, p_ids: ids });

  return NextResponse.json({ success: true });
});
