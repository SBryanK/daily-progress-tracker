#!/usr/bin/env tsx

/**
 * Deterministic importer that rebuilds ProgressEntry rows directly from
 * daily.txt using the text file as the single source of truth.
 *
 * Header grammar handled:
 *   <Month YYYY>                              → sets current month / year
 *   "Week N (a - b) — Weekday"                → start = day `a` of current month,
 *                                               final date = start + (weekday-Mon)
 *   "Week N (a/M - b/M) — Weekday"            → same but allows cross-month ranges
 *   "Week N (a - b Mon) — Weekday" / "(a - b MonAbbr)" → explicit end-month
 *   "Week N — Weekday"                        → fall back: first weekday-of-month
 *                                               rows of that weekday, walking forward
 *   "Week N — Plan" / "Week N — Progress"     → June–July 2025 plan/progress matrix:
 *                                               entries collected under the
 *                                               Monday of that week as a single
 *                                               weekly-recap row (legacy format)
 *
 * Body grammar handled:
 *   HH:MM–HH:MM — activity                    → normal time-boxed entry
 *   HH:MM–HH:MM activity                      → same, en-dash optional
 *   Notes: …                                  → attached to the PREVIOUS entry
 *   Extra: …                                  → attached to the PREVIOUS entry
 *   Half day                                  → standalone note for the day
 *   free-text paragraph                       → folded into the day's description
 *   (Extra: …) on its own line                → ditto
 *
 * The importer WIPES the target user's existing ProgressEntry rows before
 * inserting so every re-run is idempotent.
 *
 * Usage:
 *   npx tsx scripts/import-daily-txt.ts
 *   npx tsx scripts/import-daily-txt.ts /absolute/path/to/daily.txt
 *   SEED_EMAIL=other@example.com npx tsx scripts/import-daily-txt.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const WEEKDAYS: Record<string, number> = {
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  sunday: 0, sun: 0,
};

interface Entry {
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  activity: string;   // one-line title
  notes?: string;     // from "Notes: …"
  extra?: string;     // from "Extra: …"
  sourceLine: number; // 1-based line number in daily.txt
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function iso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Parse a week header like:
 *   "Week 1 (1 - 3) — Monday"
 *   "Week 1 (29/9 - 3/10) — Friday"
 *   "Week 2 (8 - 12 Dec) — Monday"
 *   "Week 4 — Monday"
 *   "Week 1 — Plan"
 *
 * Returns { weekday, rangeStart, rangeStartMonth, rangeStartYear, isPlan? }
 * or null if the line isn't a week header at all.
 */
interface WeekHeader {
  weekdayKey: string;       // lowercased weekday name, or "plan"/"progress"
  rangeStartDay?: number;   // first day of the week's date range
  rangeStartMonth?: number; // month for rangeStartDay (resolved against currentMonth)
  rangeStartYear?: number;  // year for rangeStartDay
  rangeEndDay?: number;
  rangeEndMonth?: number;
}

function parseWeekHeader(
  line: string,
  currentMonth: number,
  currentYear: number,
): WeekHeader | null {
  // Normalise all dash characters to ASCII `-` for easier matching.
  const normalised = line
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  // Must start with "Week <N>" to qualify as a week header.
  if (!/^Week\s+\d+/i.test(normalised)) return null;

  // Everything after the last " - " dash is the weekday (or "Plan" / "Progress").
  // Example tails we must accept:
  //   "Monday"  "Monday (Singapore Office Visit)"  "Friday (Holiday)"  "Plan"
  const tailMatch = normalised.match(/\s-\s([^-][^-]*?)(?:\s*\(.*\))?\s*$/);
  if (!tailMatch) return null;
  const tailRaw = tailMatch[1]!.trim().toLowerCase();

  // "Plan" / "Progress" special case — the whole week collapses into one slot.
  if (tailRaw === "plan" || tailRaw === "progress" || tailRaw === "plans") {
    return { weekdayKey: tailRaw };
  }

  const weekdayKey = tailRaw.split(/\s+/)[0]!;
  if (!(weekdayKey in WEEKDAYS)) return null;

  // Now extract the range portion, if any, e.g. "(1 - 3)", "(29/9 - 3/10)",
  // "(8 - 12 Dec)", "(8 Dec - 12 Dec)", "(1 Jan - 2 Jan)".
  const rangeMatch = normalised.match(/\(([^)]+)\)/);
  if (!rangeMatch) {
    // e.g. "Week 4 - Monday" (August/September template). Caller will resolve
    // via "Nth weekday of current month" fallback.
    return { weekdayKey };
  }
  const rangeInner = rangeMatch[1]!.trim();

  // Split on " - " (spaces around the dash).
  const parts = rangeInner.split(/\s*-\s*/);
  if (parts.length !== 2) return { weekdayKey };

  const [leftRaw, rightRaw] = parts as [string, string];
  const left = parsePiece(leftRaw, currentMonth, currentYear);
  const right = parsePiece(rightRaw, currentMonth, currentYear);
  if (!left) return { weekdayKey };

  // If only the right half specifies a month (e.g. "8 - 12 Dec"), propagate it
  // left so both halves carry it.
  let leftMonth = left.month ?? right?.month ?? currentMonth;
  let leftYear = left.year ?? currentYear;
  if (!left.month && right?.month && right.month < currentMonth) {
    // e.g. "29/9 - 3/10" while currentMonth = 10 → the left side is 29/9
    // means September of the same year. Already handled above.
  }

  return {
    weekdayKey,
    rangeStartDay: left.day,
    rangeStartMonth: leftMonth,
    rangeStartYear: leftYear,
    rangeEndDay: right?.day,
    rangeEndMonth: right?.month ?? leftMonth,
  };
}

/** Parse "29/9" / "8" / "8 Dec" / "8 December" into {day, month?, year?}. */
function parsePiece(
  piece: string,
  currentMonth: number,
  currentYear: number,
): { day: number; month?: number; year?: number } | null {
  const p = piece.trim();
  // "29/9" or "29/9/2025"
  let m = p.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : undefined;
    return { day, month, year };
  }
  // "8 Dec", "8 December", "30 December"
  m = p.match(/^(\d{1,2})\s+([A-Za-z]+)$/);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS[m[2]!.toLowerCase()];
    if (!mon) return { day };
    return { day, month: mon };
  }
  // Bare "8"
  m = p.match(/^(\d{1,2})$/);
  if (m) {
    return { day: Number(m[1]) };
  }
  return null;
}

/**
 * Parse a month header line, returning the new {month, year} or null.
 */
function parseMonthHeader(
  line: string,
): { month: number; year: number } | null {
  // "April 2026", "February 2026 (New Template)", "JuneJuly 2025" (a typo we
  // just map to June 2025), "March 2026"
  const l = line.trim();
  if (/^junejuly\b/i.test(l)) return { month: 6, year: 2025 };
  const m = l.match(/^([A-Za-z]+)\s+(\d{4})(?:\s*\(.*\))?$/);
  if (!m) return null;
  const mon = MONTHS[m[1]!.toLowerCase()];
  if (!mon) return null;
  return { month: mon, year: Number(m[2]) };
}

/**
 * Parse a time-block line:
 *   "09:00–09:30 — Foo bar"
 *   "09:00-09:30 - Foo bar"
 *   "9:00–9:30 Foo bar"
 * Returns { startTime, endTime, activity } or null.
 */
function parseTimeBlock(
  line: string,
): { startTime: string; endTime: string; activity: string } | null {
  const m = line.match(
    /^(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})\s*[–\-—]?\s*(.*)$/,
  );
  if (!m) return null;
  const [, sh, sm, eh, em, rest] = m;
  const activity = (rest ?? "").trim().replace(/^[—–\-]\s*/, "");
  if (!activity) return null;
  return {
    startTime: `${pad2(Number(sh))}:${sm}`,
    endTime: `${pad2(Number(eh))}:${em}`,
    activity,
  };
}

function deriveProjectName(text: string): string | null {
  const keywords = [
    "Tencent", "DANA", "BNI", "Pertamedika", "Galeri24", "Galeri 24",
    "Allobank", "Allo Bank", "XL Smart", "XLSmart", "Indosat", "IndoSat",
    "HSBC", "ExxonMobil", "Exxon", "MSCI", "Prada", "Telkomsel",
    "Maxstream", "World Cup", "Fusion CDN", "GraphQL", "DNSSec", "SASE",
    "NUS", "NTU", "EdgeOne", "EO", "Akamai", "CEM", "WeCom", "iWiki",
    "OpenClaw", "Codebuddy", "MNC", "Visionet", "Kimia Farma", "YY",
    "Eksad", "Hisense", "Kunlun",
  ];
  for (const k of keywords) {
    if (text.includes(k)) return k;
  }
  return null;
}

function deriveCategory(text: string): string | null {
  const t = text.toLowerCase();
  if (/(meeting|meet|call|sync|discuss|catch up|standup|bi-?weekly)/.test(t))
    return "Meeting";
  if (/(training|train|workshop|session|sharing|onboard|intern)/.test(t))
    return "Training";
  if (/(test|testing|poc|packet capture|debug)/.test(t)) return "Testing";
  if (/(research|study|learn|explore|documentation|document)/.test(t))
    return "Research";
  if (/(customer|client|follow up|proposal|pitch)/.test(t))
    return "Customer Engagement";
  if (/(security|waf|ddos|bot|captcha)/.test(t)) return "Security";
  if (/(cert|certification|exam)/.test(t)) return "Certification";
  if (/(travel|lunch|dinner|breakfast|office tour|catch up|cath up)/.test(t))
    return "Admin";
  if (/(config|configuration|rule|property manager|json)/.test(t))
    return "Development";
  return null;
}

function minutesBetween(s?: string, e?: string): number | null {
  if (!s || !e) return null;
  const [sh, sm] = s.split(":").map(Number) as [number, number];
  const [eh, em] = e.split(":").map(Number) as [number, number];
  const d = eh * 60 + em - (sh * 60 + sm);
  return d > 0 ? d : null;
}

/**
 * Resolve a week header + weekday into an ISO date. Falls back to
 * "Nth occurrence of <weekday> in currentMonth/currentYear" when the
 * header has no explicit range (August/September 2025 templates).
 */
function resolveDate(
  header: WeekHeader,
  weekNumber: number,
  currentMonth: number,
  currentYear: number,
): string | null {
  const wd = WEEKDAYS[header.weekdayKey];
  if (wd === undefined) return null;

  // Case A: header has an explicit range like "(1 - 3)" or "(29/9 - 3/10)".
  if (header.rangeStartDay) {
    const y = header.rangeStartYear ?? currentYear;
    const m = header.rangeStartMonth ?? currentMonth;
    // Walk forward from rangeStart until we hit the requested weekday.
    for (let offset = 0; offset < 7; offset++) {
      const dayNum = header.rangeStartDay + offset;
      // Handle rollover past the month's last day.
      const dim = daysInMonth(y, m);
      if (dayNum <= dim) {
        if (weekdayOf(y, m, dayNum) === wd) return iso(y, m, dayNum);
      } else {
        // Cross into the next month.
        const rollDay = dayNum - dim;
        const nm = m === 12 ? 1 : m + 1;
        const ny = m === 12 ? y + 1 : y;
        if (weekdayOf(ny, nm, rollDay) === wd) return iso(ny, nm, rollDay);
      }
    }
    return null;
  }

  // Case B: no range → Nth occurrence of weekday in the current month.
  let occurrencesNeeded = weekNumber;
  const dim = daysInMonth(currentYear, currentMonth);
  for (let d = 1; d <= dim; d++) {
    if (weekdayOf(currentYear, currentMonth, d) === wd) {
      occurrencesNeeded--;
      if (occurrencesNeeded === 0) return iso(currentYear, currentMonth, d);
    }
  }
  return null;
}

interface ParseResult {
  entries: Entry[];
  unresolvedHeaders: string[];
}

function parseDailyTxt(content: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const entries: Entry[] = [];
  const unresolvedHeaders: string[] = [];

  let currentMonth = 0;
  let currentYear = 0;
  let currentWeekNumber = 0;
  let currentDate: string | null = null;
  let currentWeekHeader: WeekHeader | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (!line) continue;

    // 1. Month header
    const mh = parseMonthHeader(line);
    if (mh) {
      currentMonth = mh.month;
      currentYear = mh.year;
      currentWeekNumber = 0;
      currentWeekHeader = null;
      currentDate = null;
      continue;
    }

    // 2. Week header
    const weekNumMatch = line.match(/^Week\s+(\d+)/i);
    if (weekNumMatch) {
      currentWeekNumber = Number(weekNumMatch[1]);
      const wh = parseWeekHeader(line, currentMonth, currentYear);
      if (wh && currentMonth && currentYear) {
        currentWeekHeader = wh;
        // Plan/Progress: point writes at the Monday of this week so all
        // weekly rows collapse into one slot.
        if (
          wh.weekdayKey === "plan" ||
          wh.weekdayKey === "progress" ||
          wh.weekdayKey === "plans"
        ) {
          const monday = resolveDate(
            { ...wh, weekdayKey: "monday" },
            currentWeekNumber,
            currentMonth,
            currentYear,
          );
          currentDate = monday;
        } else {
          currentDate = resolveDate(
            wh,
            currentWeekNumber,
            currentMonth,
            currentYear,
          );
          if (!currentDate) unresolvedHeaders.push(`L${i + 1}: ${line}`);
        }
      }
      continue;
    }

    // 3. Body line — only meaningful if we have a current date.
    if (!currentDate) {
      // Sub-markers like "Weekly Recap: ..." or "JuneJuly 2025" we don't need.
      continue;
    }

    // 3a. Notes: / Extra:  → attach to previous entry for THIS date.
    const notesMatch = line.match(/^Notes:\s*(.+)$/i);
    if (notesMatch) {
      const last = findLastEntryForDate(entries, currentDate);
      if (last) last.notes = (last.notes ? last.notes + " " : "") + notesMatch[1]!.trim();
      continue;
    }
    const extraMatch = line.match(/^Extra:\s*(.+)$/i);
    if (extraMatch) {
      const last = findLastEntryForDate(entries, currentDate);
      if (last) last.extra = (last.extra ? last.extra + " " : "") + extraMatch[1]!.trim();
      continue;
    }
    // Parenthetical "(Extra: …)" standalone line.
    const parenExtraMatch = line.match(/^\(Extra:\s*(.+?)\)?$/i);
    if (parenExtraMatch) {
      const last = findLastEntryForDate(entries, currentDate);
      if (last) last.extra = (last.extra ? last.extra + " " : "") + parenExtraMatch[1]!.trim().replace(/\)$/, "");
      continue;
    }

    // 3b. Time-block entry.
    const tb = parseTimeBlock(line);
    if (tb) {
      entries.push({
        date: currentDate,
        startTime: tb.startTime,
        endTime: tb.endTime,
        activity: tb.activity,
        sourceLine: i + 1,
      });
      continue;
    }

    // 3c. "Half day" marker — record as a zero-duration note entry.
    if (/^Half\s+day$/i.test(line)) {
      entries.push({
        date: currentDate,
        activity: "Half day",
        sourceLine: i + 1,
      });
      continue;
    }

    // 3d. Weekly-recap header line: "Weekly Recap: <text>" → attach as an entry.
    const recapMatch = line.match(/^Weekly\s+Recap\s*:\s*(.+)$/i);
    if (recapMatch) {
      entries.push({
        date: currentDate,
        activity: `Weekly Recap: ${recapMatch[1]!.trim()}`,
        sourceLine: i + 1,
      });
      continue;
    }

    // 3e-pre. Legacy weekly-grid section marker — bare stakeholder label
    // ("Bryan", "Mr. Sam", "Ms. Wen", "Mr. Wei Liu", "Mr. Dexmond") WITHOUT
    // a trailing colon. These are headers delimiting the bullets that
    // follow within the same day, NOT entries in their own right.
    const bareStakeholderMatch = line.match(
      /^(?:Bryan|Mr\.?\s+\w+(?:\s+\w+)?|Ms\.?\s+\w+(?:\s+\w+)?)\s*$/i,
    );
    if (bareStakeholderMatch) {
      continue;
    }

    // 3e. Numbered / stakeholder line from the August–January grid
    // (e.g. "Bryan: 1. Meet new Friends", "Mr. Sam: 1. Report first day",
    //  "To do / Done: …", "Progress: …"). For legacy day-grid entries this
    // produces one entry per marker; trailing bullets on subsequent lines
    // are folded into its notes via branch 3g.
    const stakeholderMatch = line.match(
      /^(Bryan|Mr\.?\s+\w+(?:\s+\w+)?|Ms\.?\s+\w+(?:\s+\w+)?|Bonus|To\s*do\s*\/\s*Done|To\s*do|Done|Plan|Plans|Progress)\s*:\s*(.*)$/i,
    );
    if (stakeholderMatch) {
      const label = stakeholderMatch[1]!.trim();
      let rest = (stakeholderMatch[2] ?? "").trim();
      rest = rest.replace(/^[-•]\s*/, "").trim();
      const activity = rest
        ? `${label}: ${rest}`.slice(0, 180)
        : label.slice(0, 180);
      entries.push({
        date: currentDate,
        activity,
        sourceLine: i + 1,
      });
      continue;
    }

    // 3f. URL-only line — append to previous entry's notes.
    if (/^https?:\/\//i.test(line)) {
      const last = findLastEntryForDate(entries, currentDate);
      if (last) {
        last.notes = (last.notes ? last.notes + "\n" : "") + line;
      }
      continue;
    }

    // 3g. Anything else — treat as a narrative sub-bullet folded into the
    // previous entry's description, or a standalone untimed entry.
    const last = findLastEntryForDate(entries, currentDate);
    if (last && last.sourceLine >= (entries.length > 0 ? entries[entries.length - 1]!.sourceLine : 0)) {
      last.notes = (last.notes ? last.notes + " " : "") + line;
    } else {
      entries.push({
        date: currentDate,
        activity: line.slice(0, 180),
        sourceLine: i + 1,
      });
    }
  }

  return { entries, unresolvedHeaders };
}

function findLastEntryForDate(entries: Entry[], date: string): Entry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.date === date) return entries[i]!;
  }
  return null;
}

async function main() {
  const filePath = resolve(process.argv[2] ?? "./daily.txt");
  console.log(`Reading ${filePath}…`);
  const content = readFileSync(filePath, "utf-8");

  console.log("Parsing…");
  const { entries, unresolvedHeaders } = parseDailyTxt(content);
  if (unresolvedHeaders.length) {
    console.warn(`⚠ ${unresolvedHeaders.length} week headers could not resolve to a date:`);
    for (const h of unresolvedHeaders.slice(0, 20)) console.warn("  " + h);
  }
  console.log(`Parsed ${entries.length} entries across ${new Set(entries.map((e) => e.date)).size} distinct dates.`);

  const email = (
    process.env.SEED_EMAIL ??
    process.env.SEED_ADMIN_EMAIL ??
    "santasila.bryan@gmail.com"
  ).toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email}. Run "npm run db:seed" first.`);
    process.exit(1);
  }

  console.log(`\nWiping existing ProgressEntry rows for ${user.email}…`);
  const before = await prisma.progressEntry.count({ where: { userId: user.id } });
  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { entry: { userId: user.id } } }),
    prisma.progressEntry.deleteMany({ where: { userId: user.id } }),
    prisma.importBatch.deleteMany({ where: { userId: user.id } }),
  ]);
  console.log(`Deleted ${before} rows.`);

  const batch = await prisma.importBatch.create({
    data: {
      userId: user.id,
      filename: "daily.txt",
      totalRows: entries.length,
      importedRows: entries.length,
      skippedRows: 0,
    },
  });

  console.log(`\nInserting ${entries.length} rows…`);
  await prisma.progressEntry.createMany({
    data: entries.map((e, idx) => {
      // Title = first line only (do NOT split mid-sentence on a period,
      // otherwise times like "10.15am" or dates like "Day 10." chop titles).
      const title = e.activity.split(/\r?\n/)[0]!.trim().slice(0, 180);
      let description = e.activity;
      if (e.notes) description += "\n\nNotes: " + e.notes;
      if (e.extra) description += "\n\nExtra: " + e.extra;
      return {
        userId: user.id,
        date: new Date(e.date + "T00:00:00Z"),
        startTime: e.startTime ?? null,
        endTime: e.endTime ?? null,
        durationMinutes: minutesBetween(e.startTime, e.endTime),
        projectName: deriveProjectName(e.activity),
        taskTitle: title || "(no title)",
        category: deriveCategory(e.activity),
        description,
        status: "COMPLETED",
        priority: "MEDIUM",
        remarks: e.notes ?? null,
        sourceSheet: "daily.txt",
        sourceRow: e.sourceLine,
        importBatchId: batch.id,
      };
    }),
  });

  const after = await prisma.progressEntry.count({ where: { userId: user.id } });
  console.log(`\n✔ Inserted ${after} rows (batch ${batch.id}).`);

  // Sanity summary
  const byMonth = new Map<string, number>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + 1);
  }
  console.log("\nPer-month counts:");
  for (const [ym, n] of [...byMonth.entries()].sort()) {
    console.log(`  ${ym}   ${n}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());