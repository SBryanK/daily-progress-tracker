import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseWorkbook, entryFingerprint } from "@/lib/excel";
import { minutesBetween } from "@/lib/utils";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Import workflow:
 *   1. POST with multipart form `file` + optional `dryRun=true`
 *   2. Server parses both template styles (see src/lib/excel.ts)
 *   3. If dryRun: return preview payload (first 50 entries + summary)
 *   4. If commit: dedup against existing entries by fingerprint, persist,
 *      and return an ImportBatch summary.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  const file = form.get("file");
  const dryRun = String(form.get("dryRun") ?? "true").toLowerCase() === "true";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "`file` is required" }, { status: 400 });
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return NextResponse.json({ error: "File must be .xlsx or .xls" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File is larger than 20 MB" }, { status: 413 });
  }

  const buf = await file.arrayBuffer();
  let parsed;
  try {
    parsed = parseWorkbook(buf);
  } catch (err) {
    logger.error("import.parse_failed", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to parse workbook" }, { status: 400 });
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      filename: file.name,
      sheets: parsed.sheetsScanned,
      template: parsed.template,
      totalParsed: parsed.entries.length,
      skipped: parsed.skipped.length,
      preview: parsed.entries.slice(0, 50),
      skippedSample: parsed.skipped.slice(0, 20),
    });
  }

  // Dedup against existing entries for this user.
  const existing = await prisma.progressEntry.findMany({
    where: { userId },
    select: { date: true, startTime: true, taskTitle: true, description: true },
  });
  const seen = new Set(
    existing.map((e) =>
      entryFingerprint({
        date: e.date.toISOString().slice(0, 10),
        startTime: e.startTime ?? undefined,
        taskTitle: e.taskTitle,
        description: e.description,
      }),
    ),
  );

  const toInsert = parsed.entries.filter((e) => !seen.has(entryFingerprint(e)));
  const skippedDup = parsed.entries.length - toInsert.length;

  try {
    const batch = await prisma.$transaction(async (tx) => {
      const b = await tx.importBatch.create({
        data: {
          userId,
          filename: file.name,
          totalRows: parsed.entries.length + parsed.skipped.length,
          importedRows: toInsert.length,
          skippedRows: parsed.skipped.length + skippedDup,
          notes: `Templates: ${JSON.stringify(parsed.template)}`,
        },
      });
      if (toInsert.length) {
        await tx.progressEntry.createMany({
          data: toInsert.map((e) => ({
            userId,
            date: new Date(e.date + "T00:00:00Z"),
            startTime: e.startTime ?? null,
            endTime: e.endTime ?? null,
            durationMinutes: minutesBetween(e.startTime, e.endTime) ?? null,
            projectName: e.projectName ?? null,
            taskTitle: e.taskTitle,
            category: e.category ?? null,
            description: e.description,
            status: e.status,
            priority: e.priority,
            remarks: e.remarks ?? null,
            sourceSheet: e.sourceSheet,
            sourceRow: e.sourceRow,
            importBatchId: b.id,
          })),
        });
      }
      return b;
    });
    return NextResponse.json({
      dryRun: false,
      batchId: batch.id,
      filename: batch.filename,
      imported: batch.importedRows,
      skipped: batch.skippedRows,
      total: batch.totalRows,
      template: parsed.template,
    });
  } catch (err) {
    logger.error("import.commit_failed", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
