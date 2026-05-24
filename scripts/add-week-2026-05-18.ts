// One-off importer: adds Bryan's daily entries for the week of
// 2026-05-18 (Mon 18 → Fri 22 May 2026).
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
// Note on 2026-05-22:
//   A STRUCTURED entry already exists on this date — the Friday
//   weekly client-engagement recap inserted by
//   add-weekly-summaries-may-2026.ts. Multiple structured entries per
//   day are supported by the journal renderer (see DayBlock /
//   structuredEntries.map() in journal-feed.tsx), so the daily entry
//   for 22 May is added alongside the recap rather than replacing it.
//
// Idempotent: re-running will skip days where a STRUCTURED entry with
// the same `taskTitle` already exists. LEGACY entries on the same
// date and other STRUCTURED entries with different titles (e.g. the
// weekly recap on 22 May) are left untouched.
//
// Run:  npx tsx scripts/add-week-2026-05-18.ts

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
  // ─── Mon 18 May 2026 ─────────────────────────────────────────────────────
  {
    isoDate: "2026-05-18",
    topThings: [
      "Improve Telkomsel's cache hit rate — identify high-impact URLs for prefetching",
      "Sync up with Jesselyn regarding AIE — root cause appears to be a Product / BD / customer communication gap",
      "Get Visionet's budget range from Pak Reynard",
    ],
    logs: [
      {
        note:
          "Asked Pak Ihvan to provide the top 10 / 100 URLs for prefetching, including the rationale, with the goal of improving cache hit rate.",
        topThingIndex: 0,
      },
      {
        note:
          "Had a call with Yan — followed up on Visionet pricing, ComoTV pricing, stakeholder mapping, and the main blocker (communication).",
        assoc: "Yan / BD sync",
      },
      {
        note: "Mingled with Hypathia, the new BD for Banking.",
        assoc: "Internal — onboarding",
      },
      {
        note:
          "Followed up with Pak Reynard — budget is around ~USD 200 [per what? still needs confirmation].",
        topThingIndex: 2,
      },
      {
        note:
          "Helped with the Indomaret Group pricing quotation — feature requirements still need to be clarified.",
        assoc: "Indomaret (CBN Cloud)",
      },
      {
        note: "Built Knotbot — a personal assistant and EdgeOne consultant.",
        assoc: "Internal tooling",
      },
    ],
    pending: [
      { note: "Pak Ihvan — top URL list for Maxstream.", topThingIndex: 0 },
      {
        note: "CBN team — feature details for Indomaret.",
        assoc: "Indomaret (CBN Cloud)",
      },
    ],
    carry: [
      { note: "Schedule a sync-up with Jesselyn.", topThingIndex: 1 },
      {
        note: "Monitor Telkomsel OOR (origin offload rate).",
        topThingIndex: 0,
      },
    ],
  },

  // ─── Tue 19 May 2026 ─────────────────────────────────────────────────────
  {
    isoDate: "2026-05-19",
    topThings: [
      "Sync up with Jesselyn about ComoTV",
      "Update weekly client progress and daily progress in AnyDev",
      "Improve Telkomsel's cache hit rate",
    ],
    logs: [
      {
        note: "Received feature details for Indomaret (CBN Cloud).",
        assoc: "Indomaret (CBN Cloud)",
      },
      {
        note:
          "Mingled with Fiona, the new Product Manager for AI Palm and eKYC.",
        assoc: "Internal — onboarding",
      },
      { note: "Explained LDNS to Maxstream.", topThingIndex: 2 },
      {
        note: "Researched Linear TV vs VOD and Starz config analysis.",
        topThingIndex: 2,
      },
      {
        note: "Did the pricing quotation for Indomaret.",
        assoc: "Indomaret (CBN Cloud)",
      },
    ],
    pending: [
      {
        note: "Get approval from BD for the pricing quotation.",
        assoc: "Indomaret (CBN Cloud)",
      },
      { note: "Manifest Structure Research — continue.", topThingIndex: 2 },
    ],
    carry: [
      { note: "Improving cache hit rate for Maxstream.", topThingIndex: 2 },
    ],
  },

  // ─── Wed 20 May 2026 ─────────────────────────────────────────────────────
  {
    isoDate: "2026-05-20",
    topThings: [
      "Analyse top-missed URLs, cache, and improvements for multi-channel TV",
      "Research Pau's lego config",
      "Learn the Customer Optimisation guidance",
    ],
    logs: [
      {
        note:
          "Call with Yan — discussed client updates and Maxstream's low origin offload rate.",
        assoc: "Yan / BD sync",
      },
      {
        note: "Studied the Customer Optimisation guidance document.",
        topThingIndex: 2,
      },
      {
        note: "Trade-off research — 3s vs 5s cache TTL.",
        topThingIndex: 0,
      },
      { note: "Translated 3 wikis.", assoc: "Internal — wiki" },
      {
        note: "Lined up a call with Desmond for tomorrow morning.",
        assoc: "IOH / Desmond",
      },
      {
        note: "Continued to monitor and improve cache hit rate for Maxstream.",
        topThingIndex: 0,
      },
    ],
    pending: [
      {
        note: "Manifest file vs Segments — priority optimisation.",
        topThingIndex: 0,
      },
      {
        note: "Get Pau's answer on cache hit rate fundamentals.",
        topThingIndex: 1,
      },
    ],
  },

  // ─── Thu 21 May 2026 ─────────────────────────────────────────────────────
  {
    isoDate: "2026-05-21",
    topThings: [
      "Analyse cache hit rate — 3-day breakdown",
      "Build a mental model for streaming workload classes",
      "Improve cache hit rate — try features and tune TTL",
    ],
    logs: [
      {
        note: "Lunch with Adam and Anson; dinner with Fiona.",
        assoc: "Internal — networking",
      },
      {
        note:
          "Rejected the Indomaret project after discussing with Jacob and senior colleagues.",
        assoc: "Indomaret (CBN Cloud)",
      },
      {
        note: "Explained EdgeOne pricing to Fiolita.",
        assoc: "Internal — pricing",
      },
      { note: "Analysed insight trace route.", topThingIndex: 0 },
      {
        note: "Drafted action plan for 3-tier caching optimisation.",
        topThingIndex: 2,
      },
    ],
    pending: [
      {
        note:
          "Recheck segment 20000095, *01, *03, *04, *34 for optimising LLS performance.",
        topThingIndex: 0,
      },
      {
        note: "Follow up on IOH resource allocation from Dexmonf.",
        assoc: "IOH",
      },
      {
        note: "Clarify and consolidate the reason behind the low cache hit rate.",
        topThingIndex: 0,
      },
    ],
  },

  // ─── Fri 22 May 2026 ─────────────────────────────────────────────────────
  // NOTE: A weekly client-engagement recap STRUCTURED entry already exists on
  // this date (see add-weekly-summaries-may-2026.ts). The journal renderer
  // supports multiple structured entries per day, so this daily entry sits
  // alongside the recap and won't displace it.
  {
    isoDate: "2026-05-22",
    topThings: [
      "Improve Maxstream's cache hit rate (compare + enhance)",
      "Update daily and weekly progress",
    ],
    logs: [
      {
        note:
          "Communicated IOH progress on resource binding to two domains (with Anil).",
        assoc: "IOH",
      },
      {
        note: "Assisted in testing the Prada domain with Angelin.",
        assoc: "Prada",
      },
      {
        note:
          "Worked on improving cache hit rate for Maxstream — backend config has been deployed but the traffic is not high enough yet to conclude the root cause.",
        topThingIndex: 0,
      },
      {
        note:
          "Communicated with Yson and Pau to discuss an OTT customer case and successful delivery.",
        assoc: "OTT customer case",
      },
      {
        note: "Updated CRM and daily progression to the websites.",
        topThingIndex: 1,
      },
    ],
    pending: [
      {
        note:
          "Get feedback from the Backend team on the date of feature-binding completion.",
        assoc: "IOH",
      },
      { note: "Work on this with, and consult, seniors.", topThingIndex: 0 },
      { note: "Get ComoTV feedback from Jesselyn.", assoc: "ComoTV" },
      {
        note: "MNC CPQ — waiting on Poshu's approval.",
        assoc: "MNC Esports",
      },
    ],
    carry: [
      { note: "Monitor Maxstream traffic.", topThingIndex: 0 },
      {
        note: "Meeting with Mandiri on Tuesday next week.",
        assoc: "Mandiri",
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
    // already exists on this date. This way the weekly recap sitting on
    // 2026-05-22 (a different title) is preserved, but re-running this
    // script won't duplicate the daily entry itself.
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
