// Structured-entry types and helpers.
//
// A "structured" entry is the new daily-template format Bryan uses
// from May 13, 2026 onwards:
//
//   Date
//   Work log: HH:mm — note   (multiple rows)
//   Top Things:   ["…", "…"]
//   Completed:    [{ note, topThingIndex|assoc }]
//   Progressing:  [{ note, topThingIndex|assoc }]
//   Tomorrow:     [{ note, topThingIndex|assoc }]
//
// On disk it lives in `ProgressEntry.structured` (Json column). Legacy
// time-blocked imports (`entryKind = "LEGACY"`) leave it NULL and keep
// rendering with their existing `description` body.

import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A single Work-log row (chronological, plain HH:mm + free text). */
export const workLogRowSchema = z.object({
  time: z.string().regex(timeRegex, "Time must be HH:MM (24h)"),
  note: z.string().min(1, "Add a note for this row.").max(2000),
});
export type WorkLogRow = z.infer<typeof workLogRowSchema>;

/**
 * A Completed / Progressing / Tomorrow item.
 *
 *   • `note` is required.
 *   • `topThingIndex` (0-based) optionally points back to one of the
 *     day's Top Things — used to render the chip `#1 Title`.
 *   • `assoc` is a free-text label for cases where the relationship is
 *     to something OTHER than that day's Top Things (e.g. "Yesterday's
 *     todo · Mandiri RFI"). The UI shows it as a softer chip.
 */
export const outcomeItemSchema = z.object({
  note: z.string().min(1, "Add a note.").max(2000),
  topThingIndex: z.number().int().min(0).max(50).optional(),
  assoc: z.string().max(200).optional(),
});
export type OutcomeItem = z.infer<typeof outcomeItemSchema>;

/** The full structured payload persisted in `ProgressEntry.structured`. */
export const structuredEntrySchema = z.object({
  workLog: z.array(workLogRowSchema).max(50).default([]),
  topThings: z
    .array(z.string().min(1).max(500))
    .min(1, "Add at least one Top Thing for today.")
    .max(20),
  completed: z.array(outcomeItemSchema).max(50).default([]),
  progressing: z.array(outcomeItemSchema).max(50).default([]),
  tomorrow: z.array(outcomeItemSchema).max(50).default([]),
});
export type StructuredEntry = z.infer<typeof structuredEntrySchema>;

/** The first calendar date on which structured entries are the default. */
export const STRUCTURED_DEFAULT_FROM = "2026-05-13";

/**
 * Sort the work-log rows chronologically by `HH:mm`. Stable for rows
 * sharing the same minute (preserves insertion order).
 */
export function sortWorkLog(rows: WorkLogRow[]): WorkLogRow[] {
  return [...rows].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

/** Normalise a structured payload before persisting. */
export function normaliseStructured(s: StructuredEntry): StructuredEntry {
  return {
    workLog: sortWorkLog(
      s.workLog.filter((r) => r.note.trim().length > 0),
    ),
    topThings: s.topThings.map((t) => t.trim()).filter((t) => t.length > 0),
    completed: s.completed.filter((r) => r.note.trim().length > 0),
    progressing: s.progressing.filter((r) => r.note.trim().length > 0),
    tomorrow: s.tomorrow.filter((r) => r.note.trim().length > 0),
  };
}

/**
 * Derive the canonical `taskTitle` for a structured entry. Used by the
 * API on insert/update so the legacy `taskTitle` column stays useful
 * for the existing /calendar / share / export surfaces.
 */
export function deriveStructuredTitle(
  s: StructuredEntry,
  isoDate: string,
): string {
  const top = s.topThings.find((t) => t.trim().length > 0)?.trim();
  if (top) return top.slice(0, 180);
  const firstLog = s.workLog.find((r) => r.note.trim().length > 0)?.note.trim();
  if (firstLog) return firstLog.slice(0, 180);
  return `Daily notes — ${isoDate}`;
}

/**
 * Render a structured entry as the canonical `description` text we
 * still write to the legacy column. Visitors with the legacy renderer
 * (or any future export) get a sensible plain-text projection of the
 * structured data so nothing is hidden.
 */
export function renderStructuredAsDescription(
  s: StructuredEntry,
  isoDate: string,
): string {
  const lines: string[] = [];
  lines.push(`[${isoDate}]`, "");
  if (s.workLog.length > 0) {
    lines.push("Work log:");
    for (const r of s.workLog) lines.push(`${r.time} — ${r.note}`);
    lines.push("");
  }
  if (s.topThings.length > 0) {
    lines.push("Focus:");
    for (const t of s.topThings) lines.push(`- ${t}`);
    lines.push("");
  }
  function dumpOutcomes(label: string, items: OutcomeItem[]) {
    if (items.length === 0) return;
    lines.push(`${label}:`);
    for (const it of items) {
      const tag =
        it.topThingIndex != null && s.topThings[it.topThingIndex]
          ? ` (re: #${it.topThingIndex + 1} ${s.topThings[it.topThingIndex]})`
          : it.assoc
            ? ` (re: ${it.assoc})`
            : "";
      lines.push(`- ${it.note}${tag}`);
    }
    lines.push("");
  }
  dumpOutcomes("Logs", s.completed);
  dumpOutcomes("Pending", s.progressing);
  dumpOutcomes("Carry On", s.tomorrow);
  return lines.join("\n").trimEnd();
}

/**
 * Type-guard helper used by the renderer / API to recover a typed
 * structured payload from the JSON value Prisma hands us. Returns null
 * if the column is empty or malformed (we never throw — the fallback
 * is to render the legacy `description` body).
 */
export function parseStructured(value: unknown): StructuredEntry | null {
  if (value == null || typeof value !== "object") return null;
  const parsed = structuredEntrySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
