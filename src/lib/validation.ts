import { z } from "zod";
import { STATUS_VALUES, PRIORITY_VALUES } from "@/lib/constants";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Entry input schema.
 *
 * Simplified per user request: the only truly required user-facing field
 * is `description`. Everything else (taskTitle, project, status, priority,
 * blockers, etc.) is optional. The server fills sensible defaults so the
 * database remains consistent for older data.
 */
export const progressEntrySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  startTime: z
    .string()
    .regex(timeRegex, "Time must be HH:MM (24h)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  endTime: z
    .string()
    .regex(timeRegex, "Time must be HH:MM (24h)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  projectName: z
    .string()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  taskTitle: z
    .string()
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  category: z
    .string()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  description: z.string().min(1, "Please write what you worked on.").max(20000),
  descriptionZh: z
    .string()
    .max(20000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  status: z
    .enum(STATUS_VALUES as [string, ...string[]])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  priority: z
    .enum(PRIORITY_VALUES as [string, ...string[]])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  blockers: z.string().max(5000).optional().or(z.literal("").transform(() => undefined)),
  nextAction: z.string().max(5000).optional().or(z.literal("").transform(() => undefined)),
  remarks: z.string().max(5000).optional().or(z.literal("").transform(() => undefined)),
  remarksZh: z.string().max(5000).optional().or(z.literal("").transform(() => undefined)),
  tags: z.string().max(500).optional().or(z.literal("").transform(() => undefined)),
  relatedLinks: z
    .string()
    .max(5000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ProgressEntryInput = z.infer<typeof progressEntrySchema>;

export const progressFilterSchema = z.object({
  q: z.string().max(200).optional(),
  project: z.string().max(200).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(25),
});

export type ProgressFilter = z.infer<typeof progressFilterSchema>;
