import { z } from "zod";
import { STATUS_VALUES, PRIORITY_VALUES } from "@/lib/constants";
import { structuredEntrySchema } from "@/lib/structured";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Entry input schema.
 *
 * The user-facing form's only truly required field is `description`.
 * Everything else (taskTitle, project, status, priority, blockers, …)
 * is optional and the server fills sensible defaults so legacy data
 * stays consistent.
 *
 * Structured-template support (added 2026-05-16):
 *   • `entryKind`  — optional, defaults to "LEGACY" server-side.
 *   • `structured` — optional payload of Top Things / Work log /
 *                    Completed / Progressing / Tomorrow.
 *
 * When `structured` is present, `description` becomes optional (the
 * server projects the structured data into a plain-text description so
 * legacy surfaces — exports, AI summary — keep working) and the schema
 * REJECTS payloads that mix raw `startTime` / `endTime` with a
 * structured body, since those are incompatible models. Per Req 4.6.
 */
export const progressEntrySchema = z
  .object({
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
    description: z
      .string()
      .max(20000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
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
    entryKind: z.enum(["LEGACY", "STRUCTURED"]).optional(),
    structured: structuredEntrySchema.optional(),
  })
  .superRefine((val, ctx) => {
    const isStructured =
      val.entryKind === "STRUCTURED" || val.structured != null;
    if (isStructured) {
      // Mixed payload — structured + raw legacy time-range — is
      // ambiguous and we refuse to guess (Req 4.6).
      if (val.startTime || val.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["_form"],
          message:
            "Structured entries can't carry a raw start/end time — put time blocks inside the work log instead.",
        });
      }
      // A structured entry without any structured body is invalid.
      if (!val.structured) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["structured"],
          message: "Structured payload is required when entryKind is STRUCTURED.",
        });
      }
    } else {
      // Legacy mode — description IS required.
      if (!val.description || val.description.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["description"],
          message: "Please write what you worked on.",
        });
      }
    }
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
