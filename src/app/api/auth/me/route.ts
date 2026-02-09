import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  return NextResponse.json({ user: authResult.user });
}
