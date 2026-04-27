import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertAdmin } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { colorSchema } from "@/lib/validation";

const createTagSchema = z.object({
  name: z.string().min(1).max(40),
  color: colorSchema.optional(),
});

export const GET = withErrorHandling(async (request) => {
  await requireAuth(request);
  const { data } = await supabase
    .from("tags")
    .select("id, name, color, created_at")
    .is("deleted_at", null)
    .order("name");
  return NextResponse.json(
    (data ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color, createdAt: t.created_at }))
  );
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  assertAdmin(user);

  const { name, color } = await parseJson(request, createTagSchema);
  const id = "tag-" + genId();

  const { error } = await supabase.from("tags").insert({
    id,
    name: name.trim(),
    color: color ?? "#7B61FF",
  });

  if (error) {
    console.error("[tags.POST] failed:", error);
    throw new ApiError("INTERNAL_ERROR", "Falha ao criar etiqueta");
  }

  return NextResponse.json({ id, name: name.trim(), color: color ?? "#7B61FF", createdAt: new Date().toISOString() }, { status: 201 });
});
