import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { colorSchema, emojiSchema, titleSchema } from "@/lib/validation";

const createProjectSchema = z.object({
  name: titleSchema,
  color: colorSchema.optional(),
  icon: emojiSchema.optional(),
});

async function getShares(projectId: string): Promise<string[]> {
  const { data } = await supabase
    .from("project_shares")
    .select("user_id")
    .eq("project_id", projectId);
  return (data ?? []).map((r) => r.user_id);
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  let projects;
  if (user.role === "admin") {
    const { data } = await supabase.from("projects").select("*").order("created_at");
    projects = data ?? [];
  } else {
    const { data } = await supabase.rpc("get_user_projects", { p_user_id: user.id });
    projects = data ?? [];
  }

  const result = await Promise.all(
    projects.map(async (p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      icon: p.icon,
      ownerId: p.owner_id,
      sharedWith: await getShares(p.id as string),
    }))
  );

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

  return NextResponse.json(
    { id, name, color: finalColor, icon: finalIcon, ownerId: user.id, sharedWith: [] },
    { status: 201 }
  );
});
