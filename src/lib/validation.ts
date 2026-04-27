import { z } from "zod";

export const idSchema = z.string().min(1).max(64);
export const usernameSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9_.-]+$/i, "Username só pode conter letras, números, _ . -");
export const nameSchema = z.string().min(1).max(100);
export const emojiSchema = z.string().max(8);
export const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, "Cor deve estar em hex (#RRGGBB)");
export const titleSchema = z.string().min(1).max(255);
export const longTextSchema = z.string().max(20_000);
export const linkSchema = z.string().max(500).url().or(z.literal(""));
export const deadlineSchema = z
  .string()
  .max(20)
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Deadline deve estar em YYYY-MM-DD ou vazia");

export const roleSchema = z.enum(["admin", "editor", "viewer"]);
export const taskStatusSchema = z.enum(["backlog", "todo", "doing", "review", "done"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const subtaskStatusSchema = z.enum(["todo", "doing", "done"]);

export const checklistItemSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(500),
  done: z.boolean().optional(),
});

export const subtaskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(255),
  status: subtaskStatusSchema.optional(),
  checked: z.boolean().optional(),
});

export const MAX_CHECKLIST_ITEMS = 50;
export const MAX_SUBTASKS = 50;
export const MAX_PROJECT_SHARES = 100;
