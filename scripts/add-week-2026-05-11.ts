// One-off importer: adds Bryan's Mon/Tue/Wed entries for the week of 2026-05-11.
//
// Source data was provided verbatim by the user (time-blocked work log).
// We persist each day as a STRUCTURED ProgressEntry, going through the
// same canonical helpers the API route uses, so rendering, AI summary,
// export and search all behave identically to entries logged via the
// in-app composer.
//
// Idempotent: re-running will skip days that already have a STRUCTURED
// entry for the target date; LEGACY entries on the same date are left
// untouched.
//
// Run:  npx tsx scripts/add-week-2026-05-11.ts

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

interface DayPlan {
  isoDate: string;
  topThings: string[];
  workLog: { time: string; note: string }[];
}

const PLAN: DayPlan[] = [
  {
    isoDate: "2026-05-11",
    topThings: [
      "Monitor and optimize Telkomsel code hit rate",
      "Test ComoTV WAF attack and build test engine",
      "Product mapping study — EO, VOD, CSS, MPS",
    ],
    workLog: [
      { time: "09:00", note: "Read email, update CEM, update client weekly progression" },
      { time: "10:00", note: "Meeting with Paratekno — Intro to LDN EdgeOne" },
      { time: "10:40", note: "Ask C2000 and 2000 about Tencent Bandung efficiency; clarify with Marchand from Telkomsel" },
      { time: "11:10", note: "Monitor and optimize Telkomsel code hit rate; clarify lower data transfer and vendor previous cache hit rate" },
      { time: "12:15", note: "Lunch" },
      { time: "13:20", note: "Test ComoTV WAF attack — make test engine" },
      { time: "15:10", note: "AI playbook for Global market — Sharing Session" },
      { time: "16:10", note: "Assist discussion about (incomplete note from source)" },
      { time: "17:00", note: "Share insights and discussion about ComoTV test result" },
      { time: "17:30", note: "Product mapping study — EO, VOD, CSS, MPS" },
    ],
  },
  {
    isoDate: "2026-05-12",
    topThings: [
      "Inditex project — review JavaScript edge functions code for yinloong",
      "EO optimization Guide",
      "Billing breakdown concept",
    ],
    workLog: [
      { time: "09:20", note: "Assist CPQ application for MNC games" },
      { time: "10:00", note: "Billing breakdown concept" },
      { time: "11:00", note: "EO optimization Guide" },
      { time: "12:00", note: "Lunch" },
      { time: "13:10", note: "Read chats from Mr. Sam; consolidate all clients record; self reflection" },
      { time: "14:30", note: "Meeting with Hank — guide to create CPQ in internal tools" },
      { time: "15:00", note: "Talk with colleague assigned" },
      { time: "16:00", note: "Inditex project again — review JavaScript edge functions code for yinloong" },
    ],
  },
  {
    isoDate: "2026-05-13",
    topThings: [
      "Plan and start to refactor all work style and approach",
      "Monitor and optimize Telkomsel cache hit rate (up 10%)",
      "Biweekly PPL Review",
    ],
    workLog: [
      { time: "09:00", note: "Follow up Paratekno; Paratekno email confirmation; PPL Review talk with colleague" },
      { time: "10:00", note: "Prepare biweekly meeting; rebuild EdgeOne security testing applications across Android, iOS and Desktop" },
      { time: "11:00", note: "Monitor and optimize Telkomsel cache hit rate (up 10%)" },
      { time: "12:15", note: "Lunch" },
      { time: "13:30", note: "Biweekly PPL Review meeting" },
      { time: "14:40", note: "CBN Cloud meeting" },
      { time: "16:00", note: "Update CEM" },
      { time: "17:00", note: "Plan and start to refactor all work style and approach" },
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

    const existing = await prisma.progressEntry.findFirst({
      where: { userId: admin.id, date: dateUtc, entryKind: "STRUCTURED" },
      select: { id: true },
    });
    if (existing) {
      console.log(`[skip] ${day.isoDate}: STRUCTURED entry already exists (id=${existing.id}).`);
      continue;
    }

    const candidate: StructuredEntry = {
      workLog: day.workLog,
      topThings: day.topThings,
      completed: [],
      progressing: [],
      tomorrow: [],
    };
    const parsed = structuredEntrySchema.safeParse(candidate);
    if (!parsed.success) {
      console.error(`[error] ${day.isoDate}: validation failed:`, parsed.error.flatten());
      process.exit(1);
    }
    // After process.exit, TS doesn't narrow parsed.data; use the
    // already-validated candidate directly (Zod confirmed its shape above).
    const norm = normaliseStructured(candidate);
    const title = deriveStructuredTitle(norm, day.isoDate);
    const description = renderStructuredAsDescription(norm, day.isoDate);

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
    console.log(`[ok]  ${day.isoDate}: inserted ${entry.id}  —  "${entry.taskTitle.slice(0, 80)}"`);
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
