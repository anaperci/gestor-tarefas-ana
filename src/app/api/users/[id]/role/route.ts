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

  const { role } = await request.json();
  if (!["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Role inválida" }, { status: 400 });
  }

  const avatars: Record<string, string> = { admin: "👑", editor: "✏️", viewer: "👁️" };
  await supabase
    .from("users")
    .update({ role, avatar: avatars[role] })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
