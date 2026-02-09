import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate, requireAdmin } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const adminCheck = requireAdmin(authResult.user!);
  if (adminCheck) return adminCheck;

  const { sharedWith } = await request.json();
  if (!Array.isArray(sharedWith)) {
    return NextResponse.json({ error: "sharedWith deve ser um array" }, { status: 400 });
  }

  // Delete existing shares
  await supabase.from("project_shares").delete().eq("project_id", id);

  // Insert new shares
  if (sharedWith.length > 0) {
    await supabase.from("project_shares").insert(
      sharedWith.map((userId: string) => ({
        project_id: id,
        user_id: userId,
      }))
    );
  }

  return NextResponse.json({ success: true, sharedWith });
}
