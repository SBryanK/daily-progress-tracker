import { Card, Badge } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { statusLabel, STATUS_COLOR, type StatusValue } from "@/lib/constants";
import type { Prisma } from "@prisma/client";
import { formatDuration } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!link || link.revoked) notFound();
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) notFound();

  const where: Prisma.ProgressEntryWhereInput = { userId: link.userId };
  if (link.fromDate || link.toDate) {
    where.date = {};
    if (link.fromDate) (where.date as Prisma.DateTimeFilter).gte = link.fromDate;
    if (link.toDate) (where.date as Prisma.DateTimeFilter).lte = link.toDate;
  }
  if (link.projectName) where.projectName = { contains: link.projectName };
  if (link.statusFilter) where.status = link.statusFilter;

  const entries = await prisma.progressEntry.findMany({
    where,
    orderBy: [{ date: "desc" }, { startTime: "asc" }],
    take: 1000,
  });

  const totalMin = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  const byProject: Record<string, number> = {};
  for (const e of entries) {
    const p = e.projectName?.trim() || "Unassigned";
    byProject[p] = (byProject[p] ?? 0) + 1;
  }

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-8 pb-6 border-b border-border">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Shared report</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{link.label}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Progress by <strong>{link.user.name}</strong>
          {link.fromDate ? ` · from ${link.fromDate.toISOString().slice(0, 10)}` : ""}
          {link.toDate ? ` to ${link.toDate.toISOString().slice(0, 10)}` : ""}
          {link.projectName ? ` · project: ${link.projectName}` : ""}
          {link.statusFilter ? ` · status: ${statusLabel(link.statusFilter)}` : ""}
        </p>
        <p className="mt-1 text-xs text-fg-subtle">Read-only view. Cannot be edited.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-fg-muted">Entries</p>
          <p className="mt-1 text-2xl font-semibold">{entries.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-fg-muted">Time logged</p>
          <p className="mt-1 text-2xl font-semibold">{formatDuration(totalMin)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-fg-muted">Projects</p>
          <p className="mt-1 text-2xl font-semibold">{Object.keys(byProject).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-fg-muted">Completed</p>
          <p className="mt-1 text-2xl font-semibold">
            {entries.filter((e) => e.status === "COMPLETED").length}
          </p>
        </Card>
      </section>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Project</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3 tabular-nums">{e.date.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 tabular-nums text-fg-muted">
                    {e.startTime ? `${e.startTime}${e.endTime ? "–" + e.endTime : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 max-w-xl">
                    <p className="font-medium">{e.taskTitle}</p>
                    <p className="text-xs text-fg-subtle prose-entry line-clamp-3">{e.description}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-fg-muted">{e.projectName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLOR[e.status as StatusValue] ?? ""}>
                      {statusLabel(e.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <footer className="mt-8 text-center text-xs text-fg-subtle">
        Generated {new Date().toISOString().slice(0, 16).replace("T", " ")} ·
        <span className="font-mono"> daily-progress-tracker</span>
      </footer>
    </main>
  );
}
