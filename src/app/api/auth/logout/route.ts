import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-error";
export const POST = withErrorHandling(async () => {
  const response = NextResponse.json({ success: true });
  response.cookies.set("clareza-session", "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
});
