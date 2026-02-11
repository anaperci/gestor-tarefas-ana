import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate, requireAdmin, hashPassword } from "@/lib/auth";

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

  const { password } = await request.json();
  if (!password) {
    return NextResponse.json({ error: "Nova senha obrigatória" }, { status: 400 });
  }

  await supabase
    .from("users")
    .update({ password_hash: await hashPassword(password) })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
