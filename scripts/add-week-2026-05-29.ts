// One-off importer: adds Bryan's daily entries for the week of
// 2026-05-29 (Mon 29 May 2026).
//
// Source data was provided verbatim by the user in the new
// "Focus / Logs / Pending / Carry" daily template. We persist each day
// as a STRUCTURED ProgressEntry, going through the same canonical
// helpers the API route uses, so rendering, AI summary, export and
// search all behave identically to entries logged via the in-app
// composer.
//
// Schema mapping (the structured schema in `src/lib/structured.ts`
// only has topThings / workLog / completed / progressing / tomorrow):
//
//   Focus    → topThings   (the day's focus items / workstreams)
//   Logs     → completed   (what actually happened during the day;
//                           no HH:mm timestamps were provided so we
//                           DON'T put them in workLog — workLog rows
//                           require a strict HH:mm time per the
//                           workLogRowSchema regex.)
//   Pending  → progressing (in-flight items still waiting on someone
//                           or something)
//   Carry    → tomorrow    (carry-overs to follow up on the next day)
//
// Idempotent: re-running will skip days where a STRUCTURED entry with
// the same `taskTitle` already exists. LEGACY entries on the same
// date and other STRUCTURED entries with different titles are left untouched.
//
// Run:  npx tsx scripts/add-week-2026-05-29.ts

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

interface OutcomeInput {
  note: string;
  topThingIndex?: number;
  assoc?: string;
}

interface DayPlan {
  isoDate: string;
  /** "Focus" — first item also doubles as the entry title. */
  topThings: string[];
  /** "Logs" — what actually happened during the day. */
  logs: OutcomeInput[];
  /** "Pending" — in-flight items still waiting on someone / something. */
  pending: OutcomeInput[];
  /** "Carry" — items to carry over to the next day (optional). */
  carry?: OutcomeInput[];
}

const PLAN: DayPlan[] = [
  // ─── Mon 29 May 2026 ─────────────────────────────────────────────────────
  {
    isoDate: "2026-05-29",
    topThings: [
      "Conduct Knot sharing session and review product update sharing session",
      "Update CEM, daily progression, and client bi-weekly reports",
      "Prepare for the presentation to Mandiri next week",
    ],
    logs: [
      {
        note: "Attended Knot session in the morning (9:00 - 10:30 AM)",
        topThingIndex: 0,
      },
      {
        note: "Monitored Telkomsel and Dana accounts",
        assoc: "Account monitoring",
      },
      {
        note: "Learned and experimented through the EdgeOne console",
        assoc: "EdgeOne learning",
      },
      {
        note: "Studied for Tencent Cloud (TC) Professional Engineers certification",
        assoc: "Certification preparation",
      },
      {
        note: "Created AI agents to automate task analysis and roadmapping",
        assoc: "AI automation",
      },
    ],
    pending: [
      {
        note: "Receive concrete plan from Telkomsel regarding POC, metrics, and full-traffic (from Ihvan, Kevin, and Bayu)",
        assoc: "Telkomsel POC",
      },
      {
        note: "Traffic ingestion to Indosat (Exclusive IP POC): waiting for the whitelist IP to be updated in the backend",
        assoc: "Indosat POC",
      },
      {
        note: "Get ComoTV price target",
        assoc: "ComoTV pricing",
      },
      {
        note: "MNC account utilization (activation pending from ID Star)",
        assoc: "MNC account",
      },
    ],
    carry: [
      {
        note: "Continue practice and study for TC Professional Engineers",
        assoc: "Certification preparation",
      },
      {
        note: "Learn EdgeOne Token V authentication",
        assoc: "EdgeOne learning",
      },
      {
        note: "Monitor Telkomsel account",
        assoc: "Account monitoring",
      },
      {
        note: "Confirm concrete plan with Pak Ihvan",
        assoc: "Telkomsel POC",
      },
    ],
  },
];

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_USERNAME },
    select: { id: true, email: true, role: true },
  });
  if (!admin) {
    throw new Error(
      `Admin user "${ADMIN_USERNAME}" not found. Run db:seed or update ADMIN_USERNAME in this script.`,
    );
  }
  if (admin.role !== "ADMIN") {
    console.warn(
      `[warn] User ${admin.email} has role=${admin.role} (expected ADMIN). Continuing — entries belong to this user.`,
    );
  }
  console.log(`[info] Owner: ${admin.email} (${admin.id})`);

  for (const day of PLAN) {
    const dateUtc = new Date(day.isoDate + "T00:00:00Z");

    const candidate: StructuredEntry = {
      workLog: [],
      topThings: day.topThings,
      completed: day.logs,
      progressing: day.pending,
      tomorrow: day.carry ?? [],
    };
    const parsed = structuredEntrySchema.safeParse(candidate);
    if (!parsed.success) {
      console.error(`[error] ${day.isoDate}: validation failed:`, parsed.error.flatten());
      process.exit(1);
    }
    const norm = normaliseStructured(candidate);
    const title = deriveStructuredTitle(norm, day.isoDate);
    const description = renderStructuredAsDescription(norm, day.isoDate);

    // Idempotency: skip if a STRUCTURED entry with the SAME derived title
    // already exists on this date.
    const existing = await prisma.progressEntry.findFirst({
      where: {
        userId: admin.id,
        date: dateUtc,
        entryKind: "STRUCTURED",
        taskTitle: title,
      },
      select: { id: true },
    });
    if (existing) {
      console.log(
        `[skip] ${day.isoDate}: STRUCTURED entry "${title.slice(0, 60)}" already exists (id=${existing.id}).`,
      );
      continue;
    }

    const entry = await prisma.progressEntry.create({
      data: {
        userId: admin.id,
        date: dateUtc,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        projectName: null,
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
  }

  console.log("[done]");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });