import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api-error";

interface NotifRow {
  id: string;
  type: string;
  task_id: string | null;
  title: string;
  read: boolean;
  created_at: string;
}

export const GET = withErrorHandling(async (request) => {
  const user = await requireAuth(request);

  const { data } = await supabase
    .from("notifications")
    .select("id, type, task_id, title, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const rows = (data ?? []) as NotifRow[];
  const items = rows.map((r) => ({
    id: r.id,
    type: r.type,
    taskId: r.task_id,
    title: r.title,
    read: r.read,
    createdAt: r.created_at,
  }));
  const unread = items.filter((n) => !n.read).length;

  return NextResponse.json({ items, unread });
});
