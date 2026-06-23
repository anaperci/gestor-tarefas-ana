import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertEditorOrAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { genId } from "@/lib/utils";
import { colorSchema, emojiSchema, titleSchema } from "@/lib/validation";

const createWorkspaceSchema = z.object({
  name: titleSchema,
  color: colorSchema.optional(),
  icon: emojiSchema.optional(),
});

interface WorkspaceRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  owner_id: string;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  let workspaces: WorkspaceRow[];
  if (user.role === "admin") {
    const { data } = await supabase
      .from("workspaces")
      .select("id, name, color, icon, owner_id")
      .is("deleted_at", null)
      .order("created_at");
    workspaces = (data ?? []) as WorkspaceRow[];
  } else {
    // Membro ou dono
    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id);
    const memberIds = (memberRows ?? []).map((r) => r.workspace_id);

    const { data } = await supabase
      .from("workspaces")
      .select("id, name, color, icon, owner_id")
      .is("deleted_at", null)
      .or(`owner_id.eq.${user.id}${memberIds.length ? `,id.in.(${memberIds.join(",")})` : ""}`)
      .order("created_at");
    workspaces = (data ?? []) as WorkspaceRow[];
  }

  // Agrega membros num único query
  const ids = workspaces.map((w) => w.id);
  const membersByWs = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: members } = await supabase
      .from("workspace_members")
      .select("workspace_id, user_id")
      .in("workspace_id", ids);
    for (const row of members ?? []) {
      const list = membersByWs.get(row.workspace_id) ?? [];
      list.push(row.user_id);
      membersByWs.set(row.workspace_id, list);
    }
  }

  return NextResponse.json(
    workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color,
      icon: w.icon,
      ownerId: w.owner_id,
      members: membersByWs.get(w.id) ?? [],
    }))
  );
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertEditorOrAdmin(user); // admin ou editor (vira gestor/dono)

  const { name, color, icon } = await parseJson(request, createWorkspaceSchema);

  const id = "ws-" + genId();
  const finalColor = color || "#15708C";
  const finalIcon = icon || "🗂️";

  const { error } = await supabase.from("workspaces").insert({
    id,
    name,
    color: finalColor,
    icon: finalIcon,
    owner_id: user.id,
  });
  if (error) {
    console.error("[workspaces.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar workspace");
  }

  // O criador (gestor) já entra como membro
  await supabase.from("workspace_members").insert({ workspace_id: id, user_id: user.id });

  await audit({
    action: "workspace.create",
    resource: "workspaces",
    resourceId: id,
    actorId: user.id,
    actorRole: user.role,
    metadata: { name },
    request,
  });

  return NextResponse.json(
    { id, name, color: finalColor, icon: finalIcon, ownerId: user.id, members: [user.id] },
    { status: 201 }
  );
});
