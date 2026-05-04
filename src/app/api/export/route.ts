import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { statusLabel, priorityLabel } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";

export const runtime = "nodejs";

type Format = "csv" | "xlsx" | "json";

function rowsFromEntries(entries: Awaited<ReturnType<typeof prisma.progressEntry.findMany>>) {
  return entries.map((e) => ({
    Date: e.date.toISOString().slice(0, 10),
    Start: e.startTime ?? "",
    End: e.endTime ?? "",
    Duration: formatDuration(e.durationMinutes ?? null),
    Project: e.projectName ?? "",
    Task: e.taskTitle,
    Category: e.category ?? "",
    Status: statusLabel(e.status),
    Priority: priorityLabel(e.priority),
    Description: e.description,
    Blockers: e.blockers ?? "",
    NextAction: e.nextAction ?? "",
    Remarks: e.remarks ?? "",
    Tags: e.tags ?? "",
    Links: e.relatedLinks ?? "",
  }));
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "xlsx") as Format;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const project = url.searchParams.get("project");
  const status = url.searchParams.get("status");

  const where: Prisma.ProgressEntryWhereInput = { userId };
  if (from || to) {
    where.date = {};
    if (from) (where.date as Prisma.DateTimeFilter).gte = new Date(from);
    if (to) (where.date as Prisma.DateTimeFilter).lte = new Date(to + "T23:59:59Z");
  }
  if (project) where.projectName = { contains: project };
  if (status) where.status = status;

  const entries = await prisma.progressEntry.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  const rows = rowsFromEntries(entries);

  if (format === "json") {
    return NextResponse.json({ rows, count: rows.length });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Progress");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="progress-${Date.now()}.csv"`,
      },
    });
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="progress-${Date.now()}.xlsx"`,
    },
  });
}
