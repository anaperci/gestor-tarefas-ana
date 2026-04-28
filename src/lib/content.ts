import { supabase } from "./supabase";
import type { ContentComment, ContentItem, ContentSlide, ContentStatusEvent } from "./types";

interface ContentRow {
  id: string;
  title: string;
  body: string;
  format: string;
  status: string;
  platform: string | null;
  target_audience: string;
  hook: string;
  cta: string;
  subject_line: string;
  preview_text: string;
  duration_seconds: number | null;
  tags: string[] | null;
  linked_project_id: string | null;
  linked_task_id: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  published_url: string;
  created_by: string;
  assigned_to: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToItem(row: ContentRow): ContentItem {
  return {
    id: row.id,
    title: row.title ?? "",
    body: row.body ?? "",
    format: row.format as ContentItem["format"],
    status: row.status as ContentItem["status"],
    platform: (row.platform as ContentItem["platform"]) ?? null,
    targetAudience: row.target_audience ?? "",
    hook: row.hook ?? "",
    cta: row.cta ?? "",
    subjectLine: row.subject_line ?? "",
    previewText: row.preview_text ?? "",
    durationSeconds: row.duration_seconds,
    tags: Array.isArray(row.tags) ? row.tags : [],
    linkedProjectId: row.linked_project_id,
    linkedTaskId: row.linked_task_id,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    publishedUrl: row.published_url ?? "",
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    lastEditedBy: row.last_edited_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface SlideRow {
  id: string;
  content_item_id: string;
  slide_number: number;
  title: string;
  body: string;
  notes: string;
  sort_order: number;
}
export function rowToSlide(row: SlideRow): ContentSlide {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    slideNumber: row.slide_number,
    title: row.title ?? "",
    body: row.body ?? "",
    notes: row.notes ?? "",
    sortOrder: row.sort_order,
  };
}

interface CommentRow {
  id: string;
  content_item_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}
export function rowToComment(row: CommentRow): ContentComment {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface HistoryRow {
  id: string;
  content_item_id: string;
  changed_by: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
}
export function rowToHistory(row: HistoryRow): ContentStatusEvent {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    changedBy: row.changed_by,
    fromStatus: row.from_status as ContentStatusEvent["fromStatus"],
    toStatus: row.to_status as ContentStatusEvent["toStatus"],
    createdAt: row.created_at,
  };
}

/** Mapeia camelCase do payload pra snake_case do banco. */
export function payloadToDbColumns(p: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    title: "title", body: "body", format: "format", status: "status",
    platform: "platform", targetAudience: "target_audience",
    hook: "hook", cta: "cta", subjectLine: "subject_line", previewText: "preview_text",
    durationSeconds: "duration_seconds", tags: "tags",
    linkedProjectId: "linked_project_id", linkedTaskId: "linked_task_id",
    assignedTo: "assigned_to", scheduledFor: "scheduled_for", publishedUrl: "published_url",
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    const dbKey = map[k];
    if (!dbKey) continue;
    if (k === "scheduledFor" && v === "") out[dbKey] = null;
    else out[dbKey] = v;
  }
  return out;
}

export type { ContentRow, SlideRow, CommentRow, HistoryRow };
