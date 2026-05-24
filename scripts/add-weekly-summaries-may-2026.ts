// One-off importer: adds Bryan's two weekly client-engagement summaries
// for May 2026:
//
//   • Friday 2026-05-15 — recap of 11–13 May (Telkomsel Maxstream POC
//     scoping, Inditex peer review, Indomaret multi-CDN, MNC, Visionet).
//   • Friday 2026-05-22 — recap of 18–22 May (Telkomsel cache-hit-rate
//     optimization, BD coordination, IOH/Indomaret/Visionet/Como TV
//     follow-ups, internal Knotbot build).
//
// Source data was provided verbatim by the user (Hello team! recap
// messages). Each summary is persisted as a STRUCTURED ProgressEntry
// dated on the Friday it was sent, going through the same canonical
// helpers the API route uses, so rendering, AI summary, export and
// search all behave identically to entries logged via the in-app
// composer.
//
// Each `topThings` slot is a workstream / client; outcomes
// (`completed` for terminal results, `progressing` for ongoing) link
// back to a Top Thing via `topThingIndex` so the journal card renders
// the `#N <client>` chip beneath every bullet.
//
// Idempotent: re-running will skip days that already have a STRUCTURED
// entry for the target date; LEGACY entries on the same date are left
// untouched.
//
// Run:  npx tsx scripts/add-weekly-summaries-may-2026.ts

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

interface SummaryPlan {
  isoDate: string;
  /** First Top Thing doubles as the entry title (see deriveStructuredTitle). */
  topThings: string[];
  /** Optional preface row in the work log so the recap context is preserved. */
  workLog?: { time: string; note: string }[];
  completed: { note: string; topThingIndex?: number; assoc?: string }[];
  progressing: { note: string; topThingIndex?: number; assoc?: string }[];
  tomorrow?: { note: string; topThingIndex?: number; assoc?: string }[];
}

const PLAN: SummaryPlan[] = [
  // ─── Week of 11–13 May 2026 ──────────────────────────────────────────────
  {
    isoDate: "2026-05-15",
    topThings: [
      "Weekly client engagement recap (11–13 May)",
      "Telkomsel Maxstream — POC scoping",
      "Indomaret (PT Indomarco Prismatama) — multi-CDN evaluation",
      "MNC Esports — CPQ / budget alignment",
      "Visionet (Lippo Group) — Acceleration-only POC",
      "Inditex / Massimo Dutti CN — Edge Function peer review",
    ],
    workLog: [
      {
        time: "17:00",
        note:
          "Sent client-engagement recap to the team — focus on Telkomsel Maxstream POC scoping, Inditex Edge Function peer review, and Indomaret multi-CDN evaluation.",
      },
    ],
    completed: [
      {
        note:
          "Drafted 3 resolution options for the CoCDN scoping issue (CoCDN only on OC77 Jakarta — general node traffic not representative); recommended checking the OC77 baseline first or routing traffic only to the Tencent OC in Indonesia.",
        topThingIndex: 1,
      },
      {
        note:
          "Escalated caching strategy for the 5→73 channel domain to the origin team.",
        topThingIndex: 1,
      },
      {
        note:
          "Confirmed internal budget: 0.0035 × 780 TB ≈ ~$2,730/mo. CPQ next steps lined up with Ahmad / Jacob.",
        topThingIndex: 3,
      },
      {
        note:
          "Validated AWS cost concern with Pak Reynard. Acceleration-only POC confirmed; BD processing the voucher.",
        topThingIndex: 4,
      },
    ],
    progressing: [
      {
        note:
          "Identified CoCDN scoping issue (CoCDN only on OC77 Jakarta — general node traffic not representative).",
        topThingIndex: 1,
      },
      {
        note:
          "MoM held on 13 May. Evaluating EdgeOne as backup CDN (multi-CDN). Volume ~2.6B req / 3.25 TB/month — needs overage pricing. Currently blocked on a leftover payment issue.",
        topThingIndex: 2,
      },
      {
        note:
          "Peer-reviewing Edge Function changes across 3 live production domains per Wilson's change-safety policy.",
        topThingIndex: 5,
      },
    ],
  },

  // ─── Week of 18–22 May 2026 ──────────────────────────────────────────────
  {
    isoDate: "2026-05-22",
    topThings: [
      "Weekly client engagement recap (18–22 May)",
      "Telkomsel Maxstream — cache hit rate optimization",
      "Indomaret (PT Indomarco Prismatama) — pricing & feature fit",
      "Indosat Ooredoo Hutchison (IOH) — resource binding",
      "Visionet (Lippo Group) — pricing alignment",
      "Como TV — pricing & stakeholder alignment",
      "Prada — domain testing support",
      "MNC Esports — CPQ approval",
      "Bank Mandiri — kickoff meeting prep",
      "Internal — Knotbot, wiki translation, optimisation study",
    ],
    workLog: [
      {
        time: "17:00",
        note:
          "Sent client-engagement recap to the team — focus on improving Telkomsel Maxstream cache hit rate, multiple BD coordination touchpoints, and progressing several new opportunities including Indomaret and IOH.",
      },
    ],
    completed: [
      {
        note:
          "Drafted a 3-tier caching optimisation action plan; deployed backend config changes. Discussed OTT customer cases with Pau and Yson for delivery references.",
        topThingIndex: 1,
      },
      {
        note:
          "Received feature details from CBN Cloud and assisted with the pricing quotation. After evaluating feature requirements vs commercial fit and discussing with Jacob and senior colleagues, decision made to decline the project.",
        topThingIndex: 2,
      },
      {
        note:
          "Followed up with Pak Reynard on Monday — budget confirmed at ~USD 200/month.",
        topThingIndex: 4,
      },
      {
        note:
          "Assisted Angelin with domain testing.",
        topThingIndex: 6,
      },
      {
        note:
          "Built Knotbot, a personal EdgeOne consultant assistant. Translated 3 internal wikis. Studied the Customer Optimisation Guidance document and Pau's Lego config for streaming workload classification.",
        topThingIndex: 9,
      },
    ],
    progressing: [
      {
        note:
          "Investigated low cache-hit-rate root cause — analysed top missed URLs across a 3-day breakdown, researched manifest-vs-segment caching priority, and tested 3s vs 5s TTL trade-offs. Asked Pak Ihvan for top-10/100 URLs for prefetching with rationale. Traffic volume currently too low to conclude the root cause; continuing to monitor.",
        topThingIndex: 1,
      },
      {
        note:
          "Coordinated with Anil on resource binding to two domains. Following up with the backend team on feature-binding completion timeline, and with Dexmond on resource allocation.",
        topThingIndex: 3,
      },
      {
        note:
          "Continuing coordination with Yan on Visionet pricing and stakeholder mapping.",
        topThingIndex: 4,
      },
      {
        note:
          "Followed up with Yan on pricing and stakeholders. Identified the main blocker as the communication gap between Product, BD and the customer. Pending sync-up with Jesselyn for further input.",
        topThingIndex: 5,
      },
      {
        note:
          "CPQ pending Poshu's approval.",
        topThingIndex: 7,
      },
      {
        note:
          "Meeting scheduled for Tuesday next week.",
        topThingIndex: 8,
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

    const existing = await prisma.progressEntry.findFirst({
      where: { userId: admin.id, date: dateUtc, entryKind: "STRUCTURED" },
      select: { id: true },
    });
    if (existing) {
      console.log(
        `[skip] ${day.isoDate}: STRUCTURED entry already exists (id=${existing.id}).`,
      );
      continue;
    }

    const candidate: StructuredEntry = {
      workLog: day.workLog ?? [],
      topThings: day.topThings,
      completed: day.completed,
      progressing: day.progressing,
      tomorrow: day.tomorrow ?? [],
    };
    const parsed = structuredEntrySchema.safeParse(candidate);
    if (!parsed.success) {
      console.error(
        `[error] ${day.isoDate}: validation failed:`,
        parsed.error.flatten(),
      );
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
