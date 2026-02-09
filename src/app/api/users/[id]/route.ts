import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate, requireAdmin } from "@/lib/auth";

export async function DELETE(
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

  if (id === authResult.user!.id) {
    return NextResponse.json({ error: "Não pode deletar a si mesmo" }, { status: 400 });
  }

  await supabase.from("users").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
