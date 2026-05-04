/**
 * Fresh re-import.
 *
 * Wipes every ProgressEntry for the target user (and the related
 * ImportBatch rows), then re-parses the Excel file with the latest
 * parser and inserts everything atomically. Use after parser fixes or
 * whenever you've double-imported.
 *
 * Usage:
 *   npx tsx scripts/reimport-fresh.ts <path-to-xlsx> [email]
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWorkbook, entryFingerprint } from "../src/lib/excel";
import { minutesBetween } from "../src/lib/utils";

async function main() {
  const [, , fileArg, emailArg] = process.argv;
  if (!fileArg) {
    console.error(
      "Usage: tsx scripts/reimport-fresh.ts <path-to-xlsx> [email]",
    );
    process.exit(1);
  }
  const path = resolve(fileArg);
  const defaultEmail =
    (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() ||
    process.env.SEED_ADMIN_EMAIL ||
    "";
  const email = (emailArg ?? defaultEmail).toLowerCase();

  const prisma = new PrismaClient();
  try {
    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!user) {
      console.error(
        `No user found${email ? ` for ${email}` : ""}. Run "npm run db:seed" first.`,
      );
      process.exit(1);
    }

    const beforeCount = await prisma.progressEntry.count({
      where: { userId: user.id },
    });
    console.log(`Deleting ${beforeCount} existing entries for ${user.email}…`);

    await prisma.$transaction([
      prisma.comment.deleteMany({
        where: { entry: { userId: user.id } },
      }),
      prisma.progressEntry.deleteMany({ where: { userId: user.id } }),
      prisma.importBatch.deleteMany({ where: { userId: user.id } }),
    ]);

    const buf = readFileSync(path);
    const parsed = parseWorkbook(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    );

    console.log(`Sheets scanned:     ${parsed.sheetsScanned.length}`);
    console.log(`Parsed entries:     ${parsed.entries.length}`);
    console.log(`Skipped rows:       ${parsed.skipped.length}`);
    console.log(`Templates detected:`);
    for (const [k, v] of Object.entries(parsed.template)) {
      console.log(`  ${k.padEnd(35)} ${v}`);
    }

    // Dedupe within the parse itself (in case of any self-duplication)
    const seen = new Set<string>();
    const toInsert = parsed.entries.filter((e) => {
      const k = entryFingerprint(e);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const batch = await prisma.importBatch.create({
      data: {
        userId: user.id,
        filename: path.split("/").pop() ?? "upload.xlsx",
        totalRows: parsed.entries.length + parsed.skipped.length,
        importedRows: toInsert.length,
        skippedRows:
          parsed.skipped.length + (parsed.entries.length - toInsert.length),
      },
    });

    if (toInsert.length) {
      await prisma.progressEntry.createMany({
        data: toInsert.map((e) => ({
          userId: user.id,
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
          importBatchId: batch.id,
        })),
      });
    }

    console.log(
      `\n✔ Inserted ${toInsert.length} fresh entries (batch ${batch.id})`,
    );

    // Print per-sheet summary so user can verify against Excel
    const bySheet = new Map<string, number>();
    for (const e of toInsert) {
      bySheet.set(e.sourceSheet, (bySheet.get(e.sourceSheet) ?? 0) + 1);
    }
    console.log("\nPer-sheet counts:");
    for (const [sheet, n] of [...bySheet.entries()].sort()) {
      console.log(`  ${sheet.padEnd(35)} ${n}`);
    }

    if (parsed.skipped.length) {
      console.log(`\nSkipped row samples (first 10):`);
      for (const s of parsed.skipped.slice(0, 10)) {
        console.log(`  [${s.sheet} r${s.row}] ${s.reason}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
