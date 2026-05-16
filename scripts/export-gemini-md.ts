/**
 * scripts/export-gemini-md.ts
 *
 * Extracts every daily entry from `daily.txt` between
 * 2026-02-09 (Mon) and 2026-05-11 (Mon) inclusive — the date range
 * Bryan asked for to feed into Gemini → Samsung Calendar — and writes
 * a single Markdown file at
 *
 *     exports/daily-2026-02-09_to_2026-05-11.md
 *
 * The output uses a stable, machine-friendly schema so an LLM
 * (Gemini) can convert each day-block into N calendar events with
 * minimal hallucination:
 *
 *     ## 2026-02-09 (Monday)
 *
 *     **Time blocks**
 *     - 09:35–10:00 · Call with Dexmond …
 *     - 10:00–11:30 · Commute to Telkomsel …
 *     …
 *
 *     **Notes**
 *     - …
 *
 * The mapping rules between `daily.txt` and ISO dates are hard-coded
 * in `WEEK_RANGES` below — derived directly from the section
 * headings ("Week 2 (9-13) — Monday" → starts on Feb 9). No date
 * arithmetic, no off-by-one risk.
 *
 * Run:
 *
 *     npx tsx scripts/export-gemini-md.ts
 *
 * Idempotent — safe to re-run.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "daily.txt");
const OUT = resolve(ROOT, "exports", "daily-2026-02-09_to_2026-05-11.md");

/** Maps every weekday section heading to its ISO date. */
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
type Weekday = (typeof WEEKDAYS)[number];

/**
 * Hand-curated week → starting-Monday table for the four months we
 * care about. Entries here are *exactly* the strings that appear in
 * `daily.txt` between the headings "February 2026 (New Template)"
 * and the end of the May 2026 section.
 */
const WEEK_TABLE: Array<{
  monthHeading: string;
  weekHeading: string;
  monday: string; // YYYY-MM-DD
}> = [
  // ── February 2026 ────────────────────────────────────────────────
  { monthHeading: "February 2026 (New Template)", weekHeading: "Week 2 (9-13)",     monday: "2026-02-09" },
  { monthHeading: "February 2026 (New Template)", weekHeading: "Week 3 (Feb 16 - 20)", monday: "2026-02-16" },
  { monthHeading: "February 2026 (New Template)", weekHeading: "Week 4 (Feb 23 - 27)", monday: "2026-02-23" },
  // ── March 2026 ──────────────────────────────────────────────────
  { monthHeading: "March 2026", weekHeading: "Week 1  (2 - 6)",  monday: "2026-03-02" },
  { monthHeading: "March 2026", weekHeading: "Week 2 (9-13)",    monday: "2026-03-09" },
  { monthHeading: "March 2026", weekHeading: "Week 3 (16-20)",   monday: "2026-03-16" },
  { monthHeading: "March 2026", weekHeading: "Week 4 (23-27)",   monday: "2026-03-23" },
  { monthHeading: "March 2026", weekHeading: "Week 5 (30-31)",   monday: "2026-03-30" },
  // ── April 2026 ──────────────────────────────────────────────────
  { monthHeading: "April 2026", weekHeading: "Week 1  (1 - 3)",  monday: "2026-03-30" }, // partial week — Wed-Fri only
  { monthHeading: "April 2026", weekHeading: "Week 2 (6 - 10)",  monday: "2026-04-06" },
  { monthHeading: "April 2026", weekHeading: "Week 3 (13 - 17)", monday: "2026-04-13" },
  { monthHeading: "April 2026", weekHeading: "Week 4 (20 - 24)", monday: "2026-04-20" },
  { monthHeading: "April 2026", weekHeading: "Week 5 (27 - 30)", monday: "2026-04-27" },
  // ── May 2026 ────────────────────────────────────────────────────
  { monthHeading: "May 2026", weekHeading: "Week 1 (4 - 8)", monday: "2026-05-04" },
];

/** Sanity bounds — only include rows whose ISO date falls in this window. */
const RANGE_START = "2026-02-09";
const RANGE_END = "2026-05-11";

/** Push a literal day onto the Monday so we can produce per-weekday ISO dates. */
function plusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()]!;
}

type DayBlock = {
  isoDate: string;
  weekday: Weekday;
  /** Raw body lines for this day (already trimmed of header / blank tail). */
  bodyLines: string[];
  /** Inline tag(s) attached to the heading e.g. "(PH)", "(Receive Red Box…)". */
  headerTag: string | null;
};

function parse(): DayBlock[] {
  const text = readFileSync(SRC, "utf8");
  const lines = text.split(/\r?\n/);

  const out: DayBlock[] = [];
  let currentMonthHeading: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Track the current month section.
    if (
      /^February 2026/.test(line) ||
      /^March 2026$/.test(line) ||
      /^April 2026$/.test(line) ||
      /^May 2026$/.test(line)
    ) {
      currentMonthHeading = line.trim();
      i++;
      continue;
    }

    // A weekday heading looks like:
    //   "Week 2 (9-13) — Monday"               (no extra tag)
    //   "Week 3 (Feb 16 - 20) — Monday (PH)"   (with a tag in parens)
    //   "Week 1  (2 - 6) — Friday (Receive Red Box Gift CNY)"
    //
    // We split on the em-dash followed by a space.
    const m = line.match(/^(.+?)\s+—\s+(Monday|Tuesday|Wednesday|Thursday|Friday)(?:\s+(\(.+\)))?\s*$/);
    if (m && currentMonthHeading) {
      const weekHeading = m[1]!.trim();
      const weekday = m[2] as Weekday;
      const headerTag = m[3] ? m[3].trim() : null;

      const row = WEEK_TABLE.find(
        (r) =>
          r.monthHeading === currentMonthHeading &&
          r.weekHeading === weekHeading,
      );
      if (!row) {
        // Not a row we know about (e.g. pre-Feb-9 entries) — skip.
        i++;
        continue;
      }
      const dayOffset = WEEKDAYS.indexOf(weekday);
      const isoDate = plusDays(row.monday, dayOffset);

      // Walk the body until the NEXT week-heading or month-heading.
      i++;
      const body: string[] = [];
      while (i < lines.length) {
        const next = lines[i]!;
        if (
          /^(February|March|April|May) 2026/.test(next) ||
          /\s+—\s+(Monday|Tuesday|Wednesday|Thursday|Friday)/.test(next)
        ) {
          break;
        }
        body.push(next);
        i++;
      }
      // Trim leading/trailing blank lines.
      while (body.length > 0 && body[0]!.trim() === "") body.shift();
      while (body.length > 0 && body[body.length - 1]!.trim() === "") body.pop();

      out.push({ isoDate, weekday, bodyLines: body, headerTag });
      continue;
    }

    i++;
  }

  // Filter to the range and sort chronologically (the file is already
  // chronological but defensive sorting protects against future edits).
  return out
    .filter((d) => d.isoDate >= RANGE_START && d.isoDate <= RANGE_END)
    .sort((a, b) => (a.isoDate < b.isoDate ? -1 : a.isoDate > b.isoDate ? 1 : 0));
}

/**
 * Render one day's body. We separate three streams:
 *   • Time blocks  — lines starting with `HH:MM–HH:MM — …`
 *   • Notes        — `(Notes: …)` or `(Extra: …)` parentheticals
 *                    that immediately follow a time block.
 *   • Free notes   — anything else (rare in this slice).
 */
function renderDay(d: DayBlock): string {
  const heading = `## ${d.isoDate} (${d.weekday})${d.headerTag ? ` — ${d.headerTag}` : ""}`;
  const lines: string[] = [heading, ""];

  type Block = { time: string; note: string; sub: string[] };
  const blocks: Block[] = [];
  const free: string[] = [];

  let current: Block | null = null;
  // When non-null we are mid-way through reading a multi-line
  // parenthetical sub-note that started with `(Label: ...` on a
  // previous line and hasn't seen a closing `)` yet. We accumulate
  // continuation lines into the previously-pushed sub item.
  let pendingSub = false;
  for (const raw of d.bodyLines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") {
      current = null;
      pendingSub = false;
      continue;
    }
    // A time block line: "HH:MM–HH:MM — text" or "HH:MM — text".
    const tb = line.match(/^\s*(\d{1,2}:\d{2}(?:[–-]\d{1,2}:\d{2})?)\s*[—-]\s*(.*)$/);
    if (tb) {
      current = { time: tb[1]!.replace("-", "–"), note: tb[2]!.trim(), sub: [] };
      blocks.push(current);
      pendingSub = false;
      continue;
    }
    // A new sub-note attached to the previous time block, e.g.
    // `(Notes: ...)` or `(Extra: ...)`. May span multiple lines
    // if the closing `)` isn't on the same line.
    if (current && /^\s*\(/.test(line)) {
      current.sub.push(line.trim());
      pendingSub = !line.trim().endsWith(")");
      continue;
    }
    // Continuation of a still-open multi-line parenthetical.
    if (current && pendingSub && current.sub.length > 0) {
      const lastIdx = current.sub.length - 1;
      current.sub[lastIdx] = current.sub[lastIdx]! + " " + line.trim();
      if (line.trim().endsWith(")")) pendingSub = false;
      continue;
    }
    // Anything else: free-text note for the day.
    free.push(line.trim());
    current = null;
    pendingSub = false;
  }

  if (blocks.length > 0) {
    lines.push("**Time blocks**");
    for (const b of blocks) {
      lines.push(`- ${b.time} · ${b.note}`);
      for (const s of b.sub) {
        lines.push(`  - ${s}`);
      }
    }
    lines.push("");
  }

  if (free.length > 0) {
    lines.push("**Notes**");
    for (const f of free) lines.push(`- ${f}`);
    lines.push("");
  }

  return lines.join("\n");
}

function render(days: DayBlock[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const header = [
    "# Bryan — Daily progress, 2026-02-09 → 2026-05-08",
    "",
    `_Generated ${today} from \`daily.txt\` for import via Google Gemini → Samsung Calendar._`,
    "",
    `**Range covered:** ${RANGE_START} (Mon) through ${days[days.length - 1]?.isoDate ?? RANGE_END}.`,
    "",
    "**Source-of-truth note:** the upstream `daily.txt` ends on **2026-05-08 (Friday)**.",
    "Days from 2026-05-11 onwards are not yet logged and are intentionally omitted —",
    "Bryan's structured daily-template entries from 2026-05-13 onwards live in the",
    "web app instead.",
    "",
    "**Format:**",
    "",
    "```",
    "## YYYY-MM-DD (Weekday) [— optional tag]",
    "",
    "**Time blocks**",
    "- HH:MM–HH:MM · description",
    "  - (Notes: optional sub-bullet)",
    "",
    "**Notes**",
    "- …",
    "```",
    "",
    "**Gemini prompt suggestion:**",
    "> _Read the markdown below. For each `## YYYY-MM-DD` heading, create one",
    "> calendar event per `Time blocks` row in Asia/Jakarta timezone (the",
    "> `HH:MM–HH:MM` defines start/end). The text after `· ` becomes the event",
    "> title. Sub-bullet `(Notes: …)` content goes into the event description._",
    "",
    "---",
    "",
  ].join("\n");

  return header + days.map(renderDay).join("\n") + "\n";
}

function main() {
  const allDays = parse();
  // Drop days with no body content (e.g. a week heading whose Friday
  // wasn't logged in daily.txt) — they would render as a ghost
  // `## YYYY-MM-DD` heading with nothing under it, which is misleading
  // both for human readers and for Gemini's calendar import step.
  const days = allDays.filter(
    (d) => d.bodyLines.some((l) => l.trim().length > 0),
  );
  if (days.length === 0) {
    // eslint-disable-next-line no-console
    console.error("No days extracted — check WEEK_TABLE / daily.txt headings.");
    process.exit(1);
  }
  const md = render(days);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${days.length} days → ${OUT}`);
}

main();
