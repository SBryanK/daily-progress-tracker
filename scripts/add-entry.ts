// Persistent generic structured-entry ingester.
//
// This replaces the per-week `add-week-YYYY-MM-DD.ts` pattern. From
// now on you NEVER have to create a new script when you want to add a
// new daily entry. Instead:
//
//   1. Append a new object to `scripts/data/entries.json`.
//   2. Run `npm run db:add-entry`.
//
// The script writes STRUCTURED entries directly into the same
// `ProgressEntry` table the in-app composer writes to, going through
// the canonical helpers (`normaliseStructured`, `deriveStructuredTitle`,
// `renderStructuredAsDescription`, `structuredEntrySchema`) so render-
// ing, AI summary, export and search behave identically to entries
// logged via the homepage composer.
//
// Schema mapping (matches the on-screen "Focus / Logs / Pending /
// Carry" daily template, identical to the previous one-off scripts):
//
//   Focus    → topThings   (first one also doubles as the entry title)
//   Logs     → completed
//   Pending  → progressing
//   Carry    → tomorrow
//
// Idempotency:
//   • By default, days where a STRUCTURED entry with the SAME derived
//     title already exists are SKIPPED (so re-running is safe).
//   • Pass `--update` to instead UPDATE the existing entry in place
//     (useful when you tweak the JSON after-the-fact).
//   • Pass `--dry-run` to validate + preview without writing.
//
// Usage:
//   npm run db:add-entry                          # default file + skip dups
//   npm run db:add-entry -- --update              # overwrite same-title days
//   npm run db:add-entry -- --dry-run             # validate only, no DB writes
//   npm run db:add-entry -- --file ./scripts/data/entries.json
//   npm run db:add-entry -- --date 2026-05-29     # only this one day
//   npm run db:add-entry -- --verify --date 2026-05-29  # check DB row exists
//
// Tip: you can keep any number of entries in the JSON file forever.
// The script only touches days whose STRUCTURED title isn't already
// present, so adding tomorrow's entry tomorrow won't re-touch today.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  normaliseStructured,
  deriveStructuredTitle,
  renderStructuredAsDescription,
  structuredEntrySchema,
  type StructuredEntry,
} from "../src/lib/structured";

const prisma = new PrismaClient();

const ADMIN_USERNAME = "sbryank";
const DEFAULT_FILE = path.resolve(__dirname, "data", "entries.json");

interface OutcomeInput {
  note: string;
  topThingIndex?: number;
  assoc?: string;
}

interface DayPlan {
  isoDate: string;
  projectName?: string;
  topThings: string[];
  logs: OutcomeInput[];
  pending: OutcomeInput[];
  carry?: OutcomeInput[];
}

interface FileShape {
  entries: DayPlan[];
  // `_comment` and any other metadata fields are ignored.
  [k: string]: unknown;
}

interface CliFlags {
  file: string;
  update: boolean;
  dryRun: boolean;
  verify: boolean;
  onlyDate?: string;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    file: DEFAULT_FILE,
    update: false,
    dryRun: false,
    verify: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--update":
        flags.update = true;
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--verify":
        flags.verify = true;
        break;
      case "--file": {
        const v = argv[++i];
        if (!v) throw new Error("--file requires a path");
        flags.file = path.resolve(process.cwd(), v);
        break;
      }
      case "--date": {
        const v = argv[++i];
        if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          throw new Error("--date requires YYYY-MM-DD");
        }
        flags.onlyDate = v;
        break;
      }
      default:
        if (a.startsWith("--")) {
          throw new Error(`Unknown flag: ${a}`);
        }
    }
  }
  return flags;
}

function loadFile(filePath: string): DayPlan[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  let parsed: FileShape;
  try {
    parsed = JSON.parse(raw) as FileShape;
  } catch (e) {
    throw new Error(
      `Invalid JSON in ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error(
      `Expected { entries: DayPlan[] } in ${filePath}, got: ${typeof parsed}`,
    );
  }
  return parsed.entries;
}

async function getOwnerId(): Promise<string> {
  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_USERNAME },
    select: { id: true, email: true, role: true },
  });
  if (!admin) {
    throw new Error(
      `Admin user "${ADMIN_USERNAME}" not found. Run \`npm run db:seed\` or update ADMIN_USERNAME in this script.`,
    );
  }
  if (admin.role !== "ADMIN") {
    console.warn(
      `[warn] User ${admin.email} has role=${admin.role} (expected ADMIN). Continuing — entries will belong to this user.`,
    );
  }
  console.log(`[info] Owner: ${admin.email} (${admin.id})`);
  return admin.id;
}

async function verify(ownerId: string, isoDate: string): Promise<void> {
  const dateUtc = new Date(isoDate + "T00:00:00Z");
  const rows = await prisma.progressEntry.findMany({
    where: {
      userId: ownerId,
      date: dateUtc,
      entryKind: "STRUCTURED",
    },
    select: { id: true, taskTitle: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  if (rows.length === 0) {
    console.log(`[verify] ❌ No STRUCTURED entry found for ${isoDate}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`[verify] ✅ ${rows.length} STRUCTURED entry/entries on ${isoDate}:`);
  for (const r of rows) {
    console.log(
      `         • id=${r.id}  updatedAt=${r.updatedAt.toISOString()}  title="${r.taskTitle.slice(0, 80)}"`,
    );
  }
}

type IngestResult =
  | "inserted"
  | "updated"
  | "skipped"
  | "would-insert"
  | "would-update";

async function ingestDay(
  ownerId: string,
  day: DayPlan,
  flags: CliFlags,
): Promise<IngestResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day.isoDate)) {
    throw new Error(`Invalid isoDate: ${day.isoDate}`);
  }
  const dateUtc = new Date(day.isoDate + "T00:00:00Z");

  const candidate: StructuredEntry = {
    workLog: [],
    topThings: day.topThings,
    completed: day.logs ?? [],
    progressing: day.pending ?? [],
    tomorrow: day.carry ?? [],
  };
  const parsed = structuredEntrySchema.safeParse(candidate);
  if (!parsed.success) {
    console.error(`[error] ${day.isoDate}: validation failed:`, parsed.error.flatten());
    throw new Error(`Validation failed for ${day.isoDate}`);
  }
  const norm = normaliseStructured(candidate);
  const title = deriveStructuredTitle(norm, day.isoDate);
  const description = renderStructuredAsDescription(norm, day.isoDate);

  // Find an existing STRUCTURED entry on this date with the SAME derived title.
  // Other entries on the same date (e.g. weekly recaps, legacy time-blocked
  // imports) are deliberately left untouched.
  const existing = await prisma.progressEntry.findFirst({
    where: {
      userId: ownerId,
      date: dateUtc,
      entryKind: "STRUCTURED",
      taskTitle: title,
    },
    select: { id: true },
  });

  if (existing) {
    if (!flags.update) {
      console.log(
        `[skip] ${day.isoDate}: STRUCTURED entry "${title.slice(0, 60)}" already exists (id=${existing.id}). Pass --update to overwrite.`,
      );
      return "skipped";
    }
    if (flags.dryRun) {
      console.log(`[dry]  ${day.isoDate}: would UPDATE id=${existing.id} "${title.slice(0, 80)}"`);
      return "would-update";
    }
    const updated = await prisma.progressEntry.update({
      where: { id: existing.id },
      data: {
        projectName: day.projectName ?? null,
        taskTitle: title,
        description,
        structured: norm as never,
      },
      select: { id: true, taskTitle: true },
    });
    console.log(
      `[upd] ${day.isoDate}: updated ${updated.id}  —  "${updated.taskTitle.slice(0, 80)}"`,
    );
    return "updated";
  }

  if (flags.dryRun) {
    console.log(`[dry]  ${day.isoDate}: would INSERT "${title.slice(0, 80)}"`);
    return "would-insert";
  }
  const entry = await prisma.progressEntry.create({
    data: {
      userId: ownerId,
      date: dateUtc,
      startTime: null,
      endTime: null,
      durationMinutes: null,
      projectName: day.projectName ?? null,
      taskTitle: title,
      category: null,
      description,
      descriptionZh: null,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      blockers: null,
      nextAction: null,
      remarks: null,
      remarksZh: null,
      tags: null,
      relatedLinks: null,
      entryKind: "STRUCTURED",
      structured: norm as never,
    },
    select: { id: true, date: true, taskTitle: true },
  });
  console.log(
    `[ok]  ${day.isoDate}: inserted ${entry.id}  —  "${entry.taskTitle.slice(0, 80)}"`,
  );
  return "inserted";
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const ownerId = await getOwnerId();

  // Verify-only mode is a thin wrapper over the same DB connection.
  if (flags.verify) {
    if (!flags.onlyDate) {
      throw new Error("--verify requires --date YYYY-MM-DD");
    }
    await verify(ownerId, flags.onlyDate);
    return;
  }

  console.log(`[info] Reading entries from: ${flags.file}`);
  const all = loadFile(flags.file);
  const days = flags.onlyDate
    ? all.filter((d) => d.isoDate === flags.onlyDate)
    : all;

  if (days.length === 0) {
    console.log(
      flags.onlyDate
        ? `[warn] No entry with isoDate=${flags.onlyDate} found in ${flags.file}.`
        : `[warn] No entries to process in ${flags.file}.`,
    );
    return;
  }

  if (flags.dryRun) {
    console.log("[info] --dry-run: no DB writes will happen.");
  }
  if (flags.update) {
    console.log("[info] --update: existing entries with the same title will be overwritten.");
  }

  const counts: Record<IngestResult, number> = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    "would-insert": 0,
    "would-update": 0,
  };

  for (const day of days) {
    const r = await ingestDay(ownerId, day, flags);
    counts[r]++;
  }

  const tail = flags.dryRun
    ? ` would-insert=${counts["would-insert"]} would-update=${counts["would-update"]}`
    : "";
  console.log(
    `[done] inserted=${counts.inserted} updated=${counts.updated} skipped=${counts.skipped}${tail}`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? (e.stack ?? e.message) : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
