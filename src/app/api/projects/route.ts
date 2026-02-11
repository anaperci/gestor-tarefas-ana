import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authenticate, requireAdmin } from "@/lib/auth";
import { genId } from "@/lib/utils";

async function getShares(projectId: string): Promise<string[]> {
  const { data } = await supabase
    .from("project_shares")
    .select("user_id")
    .eq("project_id", projectId);
  return (data || []).map((r) => r.user_id);
}

export async function GET(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;

  let projects;
  if (user.role === "admin") {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at");
    projects = data || [];
  } else {
    const { data } = await supabase.rpc("get_user_projects", { p_user_id: user.id });
    projects = data || [];
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
}

export async function POST(request: NextRequest) {
  const authResult = await authenticate(request);
  if (authResult.error) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const adminCheck = requireAdmin(authResult.user!);
  if (adminCheck) return adminCheck;

  const { name, color, icon } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  const id = "proj-" + genId();
  const { error } = await supabase.from("projects").insert({
    id,
    name,
    color: color || "#7B61FF",
    icon: icon || "📌",
    owner_id: authResult.user!.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { id, name, color: color || "#7B61FF", icon: icon || "📌", ownerId: authResult.user!.id, sharedWith: [] },
    { status: 201 }
  );
}
