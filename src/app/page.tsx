import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUserIdFilter, getAdminIds } from "@/lib/public";
import { PublicShell } from "@/components/public-shell";
import { JournalFeed } from "@/components/journal-feed";
import { AiSummaryPanel } from "@/components/ai-summary-panel";
import { Hero } from "@/components/hero";
import { JournalEmpty } from "@/components/journal-empty";
import { TodayComposer } from "@/components/today-composer";
import {
  ThisWeekStrip,
  type ThisWeekItem,
} from "@/components/this-week-strip";
import { parseStructured } from "@/lib/structured";
import { todayInJakartaISO } from "@/lib/time";

export const dynamic = "force-dynamic";

const INITIAL_PAGE_SIZE = 20;

/**
 * Landing page — Bryan's main daily-notes dashboard.
 *
 * Layout, top-down:
 *
 *   1. <Hero>             — minimal title block.
 *   2. Owner-only:
 *      <TodayComposer>    — pre-filled with today's date, edit-mode
 *                          when today's structured entry already
 *                          exists. Replaces the old AdminCta link;
 *                          the legacy /progress/new flow is still
 *                          available via a small backfill link inside
 *                          the composer's footer.
 *   3. Visitor-friendly:
 *      <ThisWeekStrip>    — top thing per day for the last 5 working
 *                          structured days, deep-linked to the
 *                          matching day cards in the journal beneath.
 *   4. <JournalFeed>      — infinite-scroll journal, polymorphic
 *                          rendering (legacy days unchanged).
 *   5. <AiSummaryPanel>   — unchanged.
 */
export default async function LandingPage() {
  const session = await auth();
  const user = session?.user
    ? {
        name: session.user.name ?? session.user.email ?? "User",
        email: session.user.email ?? "",
        role:
          ((session.user as unknown as { role?: string }).role as
            | "ADMIN"
            | "VIEWER"
            | undefined) ?? "VIEWER",
      }
    : null;
  const isAdmin = user?.role === "ADMIN";

  const userFilter = await adminUserIdFilter();

  // 1) Initial page of journal entries.
  const rows = await prisma.progressEntry.findMany({
    where: { userId: userFilter },
    orderBy: [
      { date: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: INITIAL_PAGE_SIZE + 1,
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      taskTitle: true,
      description: true,
      descriptionZh: true,
      projectName: true,
      category: true,
      remarks: true,
      remarksZh: true,
      durationMinutes: true,
      entryKind: true,
      structured: true,
    },
  });
  const hasMore = rows.length > INITIAL_PAGE_SIZE;
  const initial = (hasMore ? rows.slice(0, INITIAL_PAGE_SIZE) : rows).map(
    (e) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      startTime: e.startTime,
      endTime: e.endTime,
      taskTitle: e.taskTitle,
      description: e.description,
      descriptionZh: e.descriptionZh,
      projectName: e.projectName,
      category: e.category,
      remarks: e.remarks,
      remarksZh: e.remarksZh,
      durationMinutes: e.durationMinutes,
      entryKind: e.entryKind,
      structured: e.structured,
    }),
  );
  const initialNextCursor = hasMore
    ? initial[initial.length - 1]!.id
    : null;
  const latestDate = initial[0]?.date ?? null;

  // 2) Owner composer hydration: today's structured entry, if any.
  const adminIds = isAdmin ? await getAdminIds() : [];
  let todayStructured: {
    id: string;
    date: string;
    taskTitle: string;
    projectName: string | null;
    structured: unknown;
  } | null = null;
  if (isAdmin && adminIds.length > 0) {
    const todayIso = todayInJakartaISO();
    const found = await prisma.progressEntry.findFirst({
      where: {
        userId: { in: adminIds },
        entryKind: "STRUCTURED",
        date: {
          gte: new Date(todayIso + "T00:00:00Z"),
          lte: new Date(todayIso + "T23:59:59Z"),
        },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        date: true,
        taskTitle: true,
        projectName: true,
        structured: true,
      },
    });
    if (found) {
      todayStructured = {
        id: found.id,
        date: found.date.toISOString().slice(0, 10),
        taskTitle: found.taskTitle,
        projectName: found.projectName,
        structured: found.structured,
      };
    }
  }

  // 3) Visitor weekly strip — last 5 structured days.
  const weekRows = await prisma.progressEntry.findMany({
    where: {
      userId: userFilter,
      entryKind: "STRUCTURED",
    },
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    take: 5,
    select: { id: true, date: true, structured: true },
  });
  const thisWeek: ThisWeekItem[] = weekRows
    .map((r) => {
      const parsed = parseStructured(r.structured);
      if (!parsed) return null;
      return {
        isoDate: r.date.toISOString().slice(0, 10),
        topThing: parsed.topThings[0]?.trim() || null,
        completedCount: parsed.completed.length,
        progressingCount: parsed.progressing.length,
      } satisfies ThisWeekItem;
    })
    .filter((x): x is ThisWeekItem => x != null);

  return (
    <PublicShell user={user}>
      <Hero />

      {/* Owner: full structured composer. */}
      {isAdmin ? (
        <TodayComposer initialEntry={todayStructured} />
      ) : null}

      {/* Visitor (and Owner): weekly summary above the journal. */}
      {thisWeek.length > 0 ? <ThisWeekStrip days={thisWeek} /> : null}

      {/* Journal — edge-to-edge on ultra-wide screens, comfortable padding on mobile. */}
      <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-14 pb-10">
        {initial.length === 0 ? (
          <JournalEmpty />
        ) : (
          <JournalFeed
            initialEntries={initial}
            initialNextCursor={initialNextCursor}
            isAdmin={isAdmin}
            pageSize={INITIAL_PAGE_SIZE}
            latestDate={latestDate}
          />
        )}
      </section>

      {/* AI summary */}
      <AiSummaryPanel />
    </PublicShell>
  );
}
