import { NextRequest } from "next/server";
import { supabase } from "./supabase";
import { genId } from "./utils";

export type AuditAction =
  | "user.create"
  | "user.delete"
  | "user.role.change"
  | "user.password.change"
  | "user.avatar.change"
  | "user.profile.update"
  | "project.create"
  | "project.delete"
  | "project.share"
  | "task.delete";

interface AuditEntry {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  actorId?: string;
  actorRole?: string;
  metadata?: Record<string, unknown>;
  request?: Request | NextRequest;
}

/**
 * Registra ação sensível no audit_logs. Falhas são silenciadas (logging não
 * deve quebrar o fluxo da request).
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const ip = entry.request?.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? entry.request?.headers.get("x-real-ip")
      ?? null;
    const userAgent = entry.request?.headers.get("user-agent") ?? null;

    await supabase.from("audit_logs").insert({
      id: "log-" + genId(),
      actor_id: entry.actorId ?? null,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      ip,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error("[audit] failed to log entry:", err);
  }
}
