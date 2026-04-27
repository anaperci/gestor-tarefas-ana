import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-error";

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);
  return NextResponse.json({ user });
});
