import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminUserIdFilter } from "@/lib/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, cursor-paginated feed of entries for the landing page's
 * infinite-scroll journal. Anonymous readers can hit this — the filter
 * is scoped to admin-owned rows only.
 *
 * Query params:
 *   cursor — ISO timestamp (updatedAt or a composite), optional
 *   limit  — 1..50, default 20
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20), 50);
  const cursor = url.searchParams.get("cursor"); // opaque id

  const userFilter = await adminUserIdFilter();

  // We sort by (date DESC, createdAt DESC, id DESC) and use the row id as
  // an opaque cursor: any row whose compound (date, createdAt, id) is
  // strictly less than the cursor's. Simpler implementation: look the
  // cursor row up and use its createdAt as a boundary.
  let where: import("@prisma/client").Prisma.ProgressEntryWhereInput = {
    userId: userFilter,
  };
  if (cursor) {
    const row = await prisma.progressEntry.findUnique({
      where: { id: cursor },
      select: { date: true, createdAt: true },
    });
    if (row) {
      where = {
        userId: userFilter,
        OR: [
          { date: { lt: row.date } },
          {
            date: row.date,
            createdAt: { lt: row.createdAt },
          },
        ],
      };
    }
  }

  const rows = await prisma.progressEntry.findMany({
    where,
    orderBy: [
      { date: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: limit + 1,
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

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  return NextResponse.json({
    entries: slice.map((e) => ({
      ...e,
      date: e.date.toISOString().slice(0, 10),
    })),
    nextCursor,
  });
}
