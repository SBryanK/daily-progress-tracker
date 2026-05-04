/**
 * Excel importer for Bryan's Daily Progress tracker.
 *
 * The real workbook contains THREE template styles (verified by direct
 * inspection of every sheet):
 *
 *  (1) WEEKLY-BLOCK  — "JuneJuly 2025"
 *      Layout per week block:
 *         row N  : [date] [ ] [Bryan] [Mr.Sam] [Mr Wei Liu] [Mr.Dexmond] [BONUS] [ ] [ ] [RECAP]
 *         row N+1: [  ]   [Week X] [What to do] [<weekly plan for Bryan>] ...
 *         row N+2: [  ]   [      ] [Progress]   [<weekly recap for Bryan>] ...
 *      One logical entry per week (Bryan column only).
 *
 *  (2) OLD-DAILY     — "August 2025" through "January 2026", "March 2026 (old)",
 *                      "October 2025" etc.
 *      Column layout (row 3 = sub-header):
 *         [ ] [ ] [Week] [Day] [Bryan:To-do] [Bryan:Progress]
 *             [Mr.Sam:To-do] [Mr.Sam:Progress]
 *             [Mr.Dexmond:To-do] [Mr.Dexmond:Progress]
 *             [Mr.Wilson:To-do] [Mr.Wilson:Progress]
 *      One row per weekday; Bryan's content lives in BOTH his To-do AND
 *      Progress columns (varies by week). Older importer versions looked
 *      only at "Progress" and missed rows where the content was typed
 *      into "To-do". The current version merges both into the description
 *      (clearly labelled) so nothing is dropped.
 *
 *  (3) NEW-DAILY     — "February 2026 (New Template)" onward
 *         [ ] [ ] [ ] [Day] [From] [To] [Activity] [Notes] [Progress] [Task]
 *                        [Team task] [Progress]
 *      Time-sliced rows, multiple per day.
 *
 * Anything we cannot confidently parse is returned in `.skipped` with a
 * reason — never silently dropped.
 */

import * as XLSX from "xlsx";

export type ParsedEntry = {
  sourceSheet: string;
  sourceRow: number; // 1-based
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  taskTitle: string;
  description: string;
  projectName?: string;
  category?: string;
  status: string;
  priority: string;
  remarks?: string;
};

export type SkippedRow = {
  sheet: string;
  row: number;
  reason: string;
};

export type TemplateKind = "WEEKLY_BLOCK" | "OLD_DAILY" | "NEW_DAILY" | "UNKNOWN";

export type ImportResult = {
  entries: ParsedEntry[];
  skipped: SkippedRow[];
  sheetsScanned: string[];
  template: Record<string, TemplateKind>;
};

const DAY_INDEX: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  thrusday: 4, // user typo preserved in some sheets
  friday: 5,
  saturday: 6,
  sunday: 0,
};

// Maps common sheet names → (month 1–12, year)
function parseSheetMonth(
  sheetName: string,
): { month: number; year: number } | null {
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const lc = sheetName.toLowerCase();
  // Handle compound names like "JuneJuly 2025" — pick the FIRST recognised month.
  const monthKey = Object.keys(months).find((m) => lc.includes(m));
  const yearMatch = lc.match(/(20\d{2})/);
  if (!monthKey || !yearMatch) return null;
  return { month: months[monthKey]!, year: parseInt(yearMatch[1]!, 10) };
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function toHHMM(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) {
    // Excel time may arrive as an epoch Date — use the UTC clock
    const h = v.getUTCHours().toString().padStart(2, "0");
    const m = v.getUTCMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  if (typeof v === "number") {
    // Excel time fraction (0..1) of a day
    const totalMin = Math.round(v * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1]!.padStart(2, "0")}:${m[2]}`;
  return undefined;
}

function dayIndex(text: string): number | null {
  const t = text.trim().toLowerCase();
  for (const [name, idx] of Object.entries(DAY_INDEX)) {
    if (t.includes(name)) return idx;
  }
  return null;
}

/** Parse a "Week N (d1 - d2)" header into the day range. */
function parseWeekRange(
  text: string,
): { start: number; end: number } | null {
  const cleaned = text.replace(/\s+/g, " ");
  const m = cleaned.match(/\((\d+)\s*[-–/,]\s*(\d+)\)/);
  if (m) return { start: parseInt(m[1]!, 10), end: parseInt(m[2]!, 10) };
  const single = cleaned.match(/\((\d+)\)/);
  if (single) return { start: parseInt(single[1]!, 10), end: parseInt(single[1]!, 10) };
  const nums = cleaned.match(/\d+/g);
  if (nums && nums.length >= 2) return { start: parseInt(nums[0]!, 10), end: parseInt(nums[nums.length - 1]!, 10) };
  if (nums && nums.length === 1) return { start: parseInt(nums[0]!, 10), end: parseInt(nums[0]!, 10) };
  return null;
}

/** Extract the week ordinal number from "Week 3 (13 - 17)" → 3. */
function parseWeekOrdinal(text: string): number | null {
  const m = text.toLowerCase().match(/week\s+(\d+)/);
  if (!m) return null;
  return parseInt(m[1]!, 10);
}

/**
 * Derive the calendar week (Mon..Fri) for a given week ordinal inside
 * a month. This is what Bryan's sheets actually encode: week 1 = the
 * first FULL work week of the month (Mon..Fri), week 2 = the next, etc.
 *
 * If the 1st of the month is already Monday, that week is week 1.
 * Otherwise week 1 starts at the first Monday on/after day 1.
 *
 * Examples:
 *   April 2026 (Apr 1 = Wed) → week 1 Mon = Apr 6
 *   August 2025 (Aug 1 = Fri) → week 1 Mon = Aug 4
 *   December 2025 (Dec 1 = Mon) → week 1 Mon = Dec 1
 */
function weekMondayFridayForOrdinal(
  month: number,
  year: number,
  weekOrdinal: number,
): number[] | null {
  if (weekOrdinal < 1) return null;
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = firstOfMonth.getUTCDay(); // 0=Sun..6=Sat
  // Offset from Monday: 0 if Mon, 1 if Sun (treat as prev week),
  //   1..6 for Tue..Sat.
  const daysUntilMonday = firstWeekday === 1 ? 0 : (8 - firstWeekday) % 7;
  const firstMondayDay = 1 + daysUntilMonday;
  const mondayDay = firstMondayDay + (weekOrdinal - 1) * 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: number[] = [];
  for (let off = 0; off < 5; off++) {
    const d = mondayDay + off;
    if (d >= 1 && d <= daysInMonth) days.push(d);
  }
  return days.length ? days : null;
}

/**
 * Given a month/year + a week day-range (Mon-offsets) + a day name,
 * return the concrete calendar date as YYYY-MM-DD.
 */
function resolveDate(
  month: number,
  year: number,
  week: { start: number; end: number } | null,
  dayName: string,
  weekOrdinal: number | null = null,
): string | null {
  const di = dayIndex(dayName);
  if (di == null) return null;

  // Preferred path: we know the week's ordinal (1, 2, 3…). Use the
  // Monday-aligned offset to pick the right weekday. This works even
  // when Bryan didn't type the "(start-end)" range, and even when the
  // range he typed is wrong (e.g. April 2026 "Week 1 (1-3)" but Monday
  // is Apr 6, not in 1..3).
  if (weekOrdinal != null) {
    const mondayFriday = weekMondayFridayForOrdinal(month, year, weekOrdinal);
    if (mondayFriday && mondayFriday.length > 0) {
      const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
      const firstWeekday = firstOfMonth.getUTCDay();
      const daysUntilMonday = firstWeekday === 1 ? 0 : (8 - firstWeekday) % 7;
      const mondayDay = 1 + daysUntilMonday + (weekOrdinal - 1) * 7;
      // Map JS day index (0=Sun..6=Sat) → Monday-offset (0=Mon..6=Sun)
      const monOffset = (di + 6) % 7;
      const day = mondayDay + monOffset;
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= daysInMonth) {
        const dt = new Date(Date.UTC(year, month - 1, day));
        return dt.toISOString().slice(0, 10);
      }
      // If computed day is out-of-month (very first/last week partial),
      // fall back to the first matching weekday inside mondayFriday.
      for (const d of mondayFriday) {
        const dt = new Date(Date.UTC(year, month - 1, d));
        if (dt.getUTCDay() === di) return dt.toISOString().slice(0, 10);
      }
    }
  }

  // Legacy path: use the explicit (start-end) range.
  const start = week?.start ?? 1;
  const end = week?.end ?? 31;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = start; d <= Math.min(end, daysInMonth); d++) {
    const dt = new Date(Date.UTC(year, month - 1, d));
    if (dt.getUTCDay() === di) {
      return dt.toISOString().slice(0, 10);
    }
  }
  return null;
}

/** First Monday (or first weekday) of a week range. */
function firstDayOfWeekRange(
  month: number,
  year: number,
  week: { start: number; end: number } | null,
): string | null {
  if (!week) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  const d = Math.min(week.start, daysInMonth);
  const dt = new Date(Date.UTC(year, month - 1, d));
  return dt.toISOString().slice(0, 10);
}

type Detection =
  | {
      template: "NEW_DAILY";
      headerRow: number;
      cols: {
        week: number;
        day: number;
        from: number;
        to: number;
        activity: number;
        notes: number;
      };
    }
  | {
      template: "OLD_DAILY";
      headerRow: number;
      cols: {
        week: number;
        day: number;
        bryanTodo: number;
        bryanProgress: number;
      };
    }
  | {
      template: "WEEKLY_BLOCK";
      headerRow: number;
      cols: {
        week: number;
        label: number;
        bryan: number;
      };
    }
  | { template: "UNKNOWN"; headerRow: 0; cols: Record<string, number> };

/** Detect the template by scanning the first ~25 rows. */
function detectTemplate(rows: unknown[][]): Detection {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r] ?? [];
    const cells = row.map((c) => cellText(c).toLowerCase());

    // NEW_DAILY header row: contains From + To + Activity (+ Notes)
    const iFrom = cells.findIndex((c) => c === "from");
    const iTo = cells.findIndex((c) => c === "to");
    const iActivity = cells.findIndex((c) => c === "activity");
    const iNotes = cells.findIndex((c) => c === "notes");

    if (iFrom >= 0 && iTo >= 0 && iActivity >= 0) {
      return {
        template: "NEW_DAILY",
        headerRow: r,
        cols: {
          week: Math.max(iFrom - 3, 0),
          day: Math.max(iFrom - 1, 0),
          from: iFrom,
          to: iTo,
          activity: iActivity,
          notes: iNotes >= 0 ? iNotes : iActivity + 1,
        },
      };
    }

    // OLD_DAILY: find "Bryan" in a header row; next row has "To do" / "Progress"
    const iBryan = cells.findIndex(
      (c) => c === "bryan" || c === "bryan ".trim(),
    );
    if (iBryan >= 0) {
      // The next row should contain To-do / Progress labels.
      const sub = (rows[r + 1] ?? []).map((c) => cellText(c).toLowerCase());
      const subHasTodo = sub[iBryan]?.includes("to do") || sub[iBryan]?.includes("to-do") || sub[iBryan]?.includes("task done");
      const subHasProgress = (sub[iBryan + 1] ?? "").includes("progress");
      if (subHasTodo || subHasProgress) {
        return {
          template: "OLD_DAILY",
          headerRow: r + 1,
          cols: {
            // Week + Day columns sit to the LEFT of Bryan. Their absolute
            // indexes are found by scanning the first data row for "Week X"
            // and a weekday — but empirically Week = iBryan-2 and Day =
            // iBryan-1 in every observed sheet.
            week: Math.max(iBryan - 2, 0),
            day: Math.max(iBryan - 1, 0),
            bryanTodo: iBryan,
            bryanProgress: iBryan + 1,
          },
        };
      }

      // WEEKLY_BLOCK: Bryan sits at e.g. col 4, with cols 5 (Sam), 6 (Wei Liu)...
      // The row BELOW contains a "Week X" label in a nearby column (col 2)
      // and "What to do" / "Progress" labels in col 3.
      const cellsNext = (rows[r + 1] ?? []).map((c) => cellText(c).toLowerCase());
      const iWeek = cellsNext.findIndex((c) => c.startsWith("week "));
      const iWhatToDo = cellsNext.findIndex((c) => c.includes("what to do"));
      if (iWeek >= 0 && iWhatToDo >= 0) {
        return {
          template: "WEEKLY_BLOCK",
          headerRow: r,
          cols: {
            week: iWeek,
            label: iWhatToDo, // "What to do" / "Progress" label column
            bryan: iBryan,
          },
        };
      }
    }
  }

  return { template: "UNKNOWN", headerRow: 0, cols: {} };
}

export function parseWorkbook(buffer: ArrayBuffer | Buffer): ImportResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const result: ImportResult = {
    entries: [],
    skipped: [],
    sheetsScanned: wb.SheetNames,
    template: {},
  };

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
      blankrows: false,
    });

    const monthInfo = parseSheetMonth(sheetName);
    const detection = detectTemplate(rows);
    result.template[sheetName] = detection.template;

    if (!monthInfo) {
      result.skipped.push({
        sheet: sheetName,
        row: 0,
        reason: "sheet name does not include a recognisable month/year",
      });
      continue;
    }
    if (detection.template === "UNKNOWN") {
      result.skipped.push({
        sheet: sheetName,
        row: 0,
        reason: "no recognised template header found",
      });
      continue;
    }

    if (detection.template === "NEW_DAILY") {
      parseNewDaily(sheetName, rows, detection, monthInfo, result);
    } else if (detection.template === "OLD_DAILY") {
      parseOldDaily(sheetName, rows, detection, monthInfo, result);
    } else if (detection.template === "WEEKLY_BLOCK") {
      parseWeeklyBlock(sheetName, rows, detection, monthInfo, result);
    }
  }

  return result;
}

function parseNewDaily(
  sheetName: string,
  rows: unknown[][],
  det: Extract<Detection, { template: "NEW_DAILY" }>,
  monthInfo: { month: number; year: number },
  result: ImportResult,
) {
  let currentWeek: { start: number; end: number } | null = null;
  let currentWeekOrdinal: number | null = null;
  let currentDay: string | null = null;

  for (let r = det.headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const weekCell = cellText(row[det.cols.week]);
    if (weekCell) {
      const wo = parseWeekOrdinal(weekCell);
      if (wo != null) currentWeekOrdinal = wo;
      const wr = parseWeekRange(weekCell);
      if (wr) currentWeek = wr;
    }
    const dayCell = cellText(row[det.cols.day]);
    if (dayCell && dayIndex(dayCell) != null) currentDay = dayCell;

    const start = toHHMM(row[det.cols.from]);
    const end = toHHMM(row[det.cols.to]);
    const activity = cellText(row[det.cols.activity]);
    const notes = cellText(row[det.cols.notes]);
    if (!activity) continue;

    if (!currentDay) {
      result.skipped.push({ sheet: sheetName, row: r + 1, reason: "no day context" });
      continue;
    }
    const date = resolveDate(
      monthInfo.month,
      monthInfo.year,
      currentWeek,
      currentDay,
      currentWeekOrdinal,
    );
    if (!date) {
      result.skipped.push({ sheet: sheetName, row: r + 1, reason: `cannot resolve date for ${currentDay}` });
      continue;
    }

    const taskTitle = activity.split(/[\n.]/)[0]!.slice(0, 180) || activity.slice(0, 180);

    result.entries.push({
      sourceSheet: sheetName,
      sourceRow: r + 1,
      date,
      startTime: start,
      endTime: end,
      taskTitle,
      description: activity,
      remarks: notes || undefined,
      status: "COMPLETED",
      priority: "MEDIUM",
    });
  }
}

function parseOldDaily(
  sheetName: string,
  rows: unknown[][],
  det: Extract<Detection, { template: "OLD_DAILY" }>,
  monthInfo: { month: number; year: number },
  result: ImportResult,
) {
  let currentWeek: { start: number; end: number } | null = null;
  let currentWeekOrdinal: number | null = null;
  let currentDay: string | null = null;

  for (let r = det.headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const weekCell = cellText(row[det.cols.week]);
    if (weekCell) {
      const wo = parseWeekOrdinal(weekCell);
      if (wo != null) currentWeekOrdinal = wo;
      const wr = parseWeekRange(weekCell);
      if (wr) currentWeek = wr;
      // Some sheets use "Week 1\n(1 Jan - 2 Jan)" — extract the numeric range already handled.
    }
    const dayCell = cellText(row[det.cols.day]);
    if (dayCell && dayIndex(dayCell) != null) currentDay = dayCell;

    const todo = cellText(row[det.cols.bryanTodo]);
    const prog = cellText(row[det.cols.bryanProgress]);
    if (!todo && !prog) continue;

    // Skip header echoes like "To do" / "Progress"
    if (todo.toLowerCase() === "to do" || prog.toLowerCase() === "progress") continue;

    if (!currentDay) {
      result.skipped.push({ sheet: sheetName, row: r + 1, reason: "no day context" });
      continue;
    }
    const date = resolveDate(
      monthInfo.month,
      monthInfo.year,
      currentWeek,
      currentDay,
      currentWeekOrdinal,
    );
    if (!date) {
      result.skipped.push({ sheet: sheetName, row: r + 1, reason: `cannot resolve date for ${currentDay}` });
      continue;
    }

    // Merge both columns with clear labels so nothing is lost.
    const parts: string[] = [];
    if (todo) parts.push(`To do:\n${todo}`);
    if (prog) parts.push(`Progress:\n${prog}`);
    const description = parts.join("\n\n");

    const firstSource = todo || prog;
    const firstLine = firstSource
      .split(/\n+/)
      .map((s) => s.replace(/^[-•\s]+/, "").trim())
      .find((s) => s.length > 0) ?? firstSource.slice(0, 80);
    const taskTitle = firstLine.slice(0, 180);

    result.entries.push({
      sourceSheet: sheetName,
      sourceRow: r + 1,
      date,
      taskTitle,
      description,
      status: "COMPLETED",
      priority: "MEDIUM",
    });
  }
}

function parseWeeklyBlock(
  sheetName: string,
  rows: unknown[][],
  det: Extract<Detection, { template: "WEEKLY_BLOCK" }>,
  monthInfo: { month: number; year: number },
  result: ImportResult,
) {
  // The block repeats: one "header" row (contains a date + names), then
  // one "What to do" row, then one "Progress" row. We walk the sheet
  // locating each "Week X" label, then read Bryan's plan and recap and
  // emit ONE entry per week.

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const weekCell = cellText(row[det.cols.week]).toLowerCase();
    if (!weekCell.startsWith("week ")) continue;

    const labelCell = cellText(row[det.cols.label]).toLowerCase();
    if (!labelCell.includes("what to do")) continue;

    const planRow = row;
    const progressRow = rows[r + 1] ?? [];

    const plan = cellText(planRow[det.cols.bryan]);
    const prog = cellText(progressRow[det.cols.bryan]);
    if (!plan && !prog) continue;

    // The date for the week is taken from the header row (the row that
    // contains the date cell at col = det.cols.week-1 or earlier). We walk
    // backwards a few rows to find a Date in the first 3 columns.
    let weekDateISO: string | null = null;
    for (let k = r - 1; k >= Math.max(0, r - 4); k--) {
      for (let c = 0; c < Math.min(4, (rows[k] ?? []).length); c++) {
        const v = rows[k]?.[c];
        if (v instanceof Date) {
          weekDateISO = v.toISOString().slice(0, 10);
          break;
        }
      }
      if (weekDateISO) break;
    }

    // Fallback: infer week number (e.g. "Week 1" → first Monday of the month)
    if (!weekDateISO) {
      const wNum = parseInt(weekCell.replace(/\D+/g, ""), 10) || 1;
      const daysInMonth = new Date(monthInfo.year, monthInfo.month, 0).getDate();
      const guess = Math.min(1 + (wNum - 1) * 7, daysInMonth);
      weekDateISO = new Date(
        Date.UTC(monthInfo.year, monthInfo.month - 1, guess),
      )
        .toISOString()
        .slice(0, 10);
    }

    const parts: string[] = [];
    if (plan) parts.push(`Plan for the week:\n${plan}`);
    if (prog) parts.push(`Progress:\n${prog}`);
    const description = parts.join("\n\n");

    const firstSource = plan || prog;
    const firstLine =
      firstSource
        .split(/\n+/)
        .map((s) => s.replace(/^[-•\s\d\.]+/, "").trim())
        .find((s) => s.length > 0) ?? firstSource.slice(0, 80);
    const taskTitle = `${weekCell.replace(/^./, (c) => c.toUpperCase())} — ${firstLine.slice(0, 140)}`;

    result.entries.push({
      sourceSheet: sheetName,
      sourceRow: r + 1,
      date: weekDateISO,
      taskTitle: taskTitle.slice(0, 180),
      description,
      status: "COMPLETED",
      priority: "MEDIUM",
      category: "Weekly summary",
    });
  }
  // Silence unused-var warning for firstDayOfWeekRange helper (kept for future)
  void firstDayOfWeekRange;
}

/** Dedup key used to skip already-imported rows on re-import. */
export function entryFingerprint(
  e: Pick<ParsedEntry, "date" | "startTime" | "taskTitle" | "description">,
): string {
  const desc = e.description.slice(0, 200);
  return `${e.date}|${e.startTime ?? ""}|${e.taskTitle}|${desc}`;
}
