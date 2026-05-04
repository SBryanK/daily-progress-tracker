import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUserIdFilter } from "@/lib/public";
import { PublicShell } from "@/components/public-shell";
import { JournalFeed } from "@/components/journal-feed";
import { AiSummaryPanel } from "@/components/ai-summary-panel";
import { Hero } from "@/components/hero";
import { AdminCta } from "@/components/admin-cta";
import { JournalEmpty } from "@/components/journal-empty";

export const dynamic = "force-dynamic";

const INITIAL_PAGE_SIZE = 20;

/**
 * Landing page.
 *
 * A minimal hero (name + Tencent Cloud logo) sits above the infinite-
 * scroll journal of daily entries. Signed-in admins see a primary
 * "Add entry" CTA immediately below the hero (in-page, not in the
 * header chrome). The AI summary block lives at the very bottom.
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
    }),
  );
  const initialNextCursor = hasMore
    ? initial[initial.length - 1]!.id
    : null;
  // The most recent date in the initial page is used to paint the
  // "live" pulse marker on the first day card. We compute it on the
  // server so the pulse is correct on first paint — no client flicker.
  const latestDate = initial[0]?.date ?? null;

  return (
    <PublicShell user={user}>
      <Hero />

      {isAdmin ? <AdminCta /> : null}

      {/* Journal */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-10">
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
