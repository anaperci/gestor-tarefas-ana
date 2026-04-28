import { z } from "zod";
import { idSchema } from "./validation";

export const contentFormatEnum = z.enum([
  "post", "carousel", "video_short", "video_long", "script_class", "email", "thread", "other",
]);
export const contentStatusEnum = z.enum(["idea", "in_production", "published", "archived"]);
export const contentPlatformEnum = z.enum([
  "instagram", "linkedin", "youtube", "tiktok", "newsletter", "multiple", "other",
]);

export const createContentSchema = z.object({
  title: z.string().max(255).optional(),
  body: z.string().max(50_000).optional(),
  format: contentFormatEnum.optional(),
});

export const updateContentSchema = z.object({
  title: z.string().max(255).optional(),
  body: z.string().max(50_000).optional(),
  format: contentFormatEnum.optional(),
  status: contentStatusEnum.optional(),
  platform: contentPlatformEnum.nullable().optional(),
  targetAudience: z.string().max(120).optional(),
  hook: z.string().max(2_000).optional(),
  cta: z.string().max(2_000).optional(),
  subjectLine: z.string().max(255).optional(),
  previewText: z.string().max(255).optional(),
  durationSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  linkedProjectId: idSchema.nullable().optional(),
  linkedTaskId: idSchema.nullable().optional(),
  assignedTo: idSchema.nullable().optional(),
  scheduledFor: z.string().datetime().nullable().or(z.literal("")).optional(),
  publishedUrl: z.string().max(500).optional(),
});

export const slideSchema = z.object({
  title: z.string().max(255).optional(),
  body: z.string().max(5_000).optional(),
  notes: z.string().max(2_000).optional(),
});

export const commentSchema = z.object({
  body: z.string().min(1).max(4_000),
});
