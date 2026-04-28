import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, assertContentAccess } from "@/lib/auth";
import { ApiError, parseJson, withErrorHandling } from "@/lib/api-error";
import { genId } from "@/lib/utils";
import { slideSchema } from "@/lib/content-schemas";
import { rowToSlide, type SlideRow } from "@/lib/content";

export const GET = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const { data } = await supabase
      .from("content_slides")
      .select("*")
      .eq("content_item_id", id)
      .order("sort_order");

    return NextResponse.json((data ?? []).map((r) => rowToSlide(r as SlideRow)));
  }
);

export const POST = withErrorHandling(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await requireAuth(request);
    assertContentAccess(user);

    const body = await parseJson(request, slideSchema);

    const { count } = await supabase
      .from("content_slides")
      .select("*", { count: "exact", head: true })
      .eq("content_item_id", id);

    const order = count ?? 0;
    const slideId = "slide-" + genId();
    const { error } = await supabase.from("content_slides").insert({
      id: slideId,
      content_item_id: id,
      slide_number: order + 1,
      title: body.title ?? "",
      body: body.body ?? "",
      notes: body.notes ?? "",
      sort_order: order,
    });

    if (error) {
      console.error("[content.slides.POST] failed:", error);
      throw new ApiError("INTERNAL_ERROR", "Falha ao criar slide");
    }

    const { data } = await supabase.from("content_slides").select("*").eq("id", slideId).single();
    return NextResponse.json(rowToSlide(data as SlideRow), { status: 201 });
  }
);
