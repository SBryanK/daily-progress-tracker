import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminUserIdFilter } from "@/lib/public";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SP = { month?: string };

function parseMonthParam(m: string | undefined): { year: number; month0: number } {
  const now = new Date();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y!, month0: (mo! - 1) };
  }
  return { year: now.getUTCFullYear(), month0: now.getUTCMonth() };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const { year, month0 } = parseMonthParam(sp.month);
  // Public-tolerant: reads are scoped to every ADMIN user; session optional.
  await auth();
  const userFilter = await adminUserIdFilter();

  const firstDay = new Date(Date.UTC(year, month0, 1));
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0));
  const daysInMonth = lastDay.getUTCDate();

  const entries = await prisma.progressEntry.findMany({
    where: {
      userId: userFilter,
      date: { gte: firstDay, lte: new Date(Date.UTC(year, month0 + 1, 0, 23, 59, 59)) },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const byDate: Record<string, typeof entries> = {};
  for (const e of entries) {
    const k = e.date.toISOString().slice(0, 10);
    (byDate[k] ??= []).push(e);
  }

  // Grid layout: first day of month may not be Monday — pad with empties.
  const firstWeekday = (firstDay.getUTCDay() + 6) % 7; // 0 = Monday
  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: `${year}-${pad2(month0 + 1)}-${pad2(d)}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = new Date(Date.UTC(year, month0 - 1, 1));
  const next = new Date(Date.UTC(year, month0 + 1, 1));
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  const label = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{label}</h1>
          <p className="mt-1 text-sm text-fg-muted">Tap any day to see the full log.</p>
        </div>
        <nav className="flex gap-2 text-sm" aria-label="Month navigation">
          <Link href={`/calendar?month=${fmt(prev)}`} className="h-9 px-3 inline-flex items-center rounded-md border border-border hover:bg-bg-muted">
            ← Previous
          </Link>
          <Link href="/calendar" className="h-9 px-3 inline-flex items-center rounded-md border border-border hover:bg-bg-muted">
            Today
          </Link>
          <Link href={`/calendar?month=${fmt(next)}`} className="h-9 px-3 inline-flex items-center rounded-md border border-border hover:bg-bg-muted">
            Next →
          </Link>
        </nav>
      </header>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-bg-subtle text-xs font-medium uppercase tracking-wider text-fg-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-3 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="min-h-28 border-r border-b border-border bg-bg-subtle/40" />;
            const dayEntries = byDate[c.key] ?? [];
            const isToday = c.key === new Date().toISOString().slice(0, 10);
            return (
              <div
                key={c.key}
                className={cn(
                  "min-h-28 border-r border-b border-border p-2 flex flex-col gap-1",
                  isToday && "bg-accent-soft/60",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-medium", isToday && "text-accent")}>{c.day}</span>
                  {dayEntries.length > 0 ? (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-label={`${dayEntries.length} entries`} />
                  ) : null}
                </div>
                <ul className="space-y-0.5">
                  {dayEntries.slice(0, 3).map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/progress/${e.id}`}
                        className="block text-[11px] truncate hover:underline text-fg"
                        title={e.taskTitle}
                      >
                        {e.taskTitle}
                      </Link>
                    </li>
                  ))}
                  {dayEntries.length > 3 ? (
                    <li>
                      <span
                        className="text-[11px] text-fg-subtle"
                        title={`${dayEntries.length - 3} more on this day`}
                      >
                        +{dayEntries.length - 3} more
                      </span>
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
