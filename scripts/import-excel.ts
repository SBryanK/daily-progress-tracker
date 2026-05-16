/**
 * CLI Excel importer.
 *
 * Usage:
 *   npx tsx scripts/import-excel.ts <path-to-xlsx> [username]
 *
 * If [username] is omitted, the script uses ADMIN_USERNAMES /
 * ADMIN_EMAILS / SEED_ADMIN_USERNAME / SEED_ADMIN_EMAIL env var (or
 * the first ADMIN user in the database). Duplicates are skipped.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWorkbook, entryFingerprint } from "../src/lib/excel";
import { minutesBetween } from "../src/lib/utils";

async function main() {
  const [, , fileArg, idArg] = process.argv;
  if (!fileArg) {
    console.error("Usage: tsx scripts/import-excel.ts <path-to-xlsx> [username]");
    process.exit(1);
  }
  const path = resolve(fileArg);
  const defaultId =
    (process.env.ADMIN_USERNAMES ?? "").split(",")[0]?.trim() ||
    (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() ||
    process.env.SEED_ADMIN_USERNAME ||
    process.env.SEED_ADMIN_EMAIL ||
    "";
  const email = (idArg ?? defaultId).toLowerCase();

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

    const buf = readFileSync(path);
    const parsed = parseWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    console.log(`Sheets: ${parsed.sheetsScanned.length}`);
    console.log(`Parsed entries: ${parsed.entries.length}`);
    console.log(`Skipped rows: ${parsed.skipped.length}`);
    console.log(`Templates detected:`, parsed.template);

    const existing = await prisma.progressEntry.findMany({
      where: { userId: user.id },
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

    const batch = await prisma.importBatch.create({
      data: {
        userId: user.id,
        filename: path.split("/").pop() ?? "upload.xlsx",
        totalRows: parsed.entries.length + parsed.skipped.length,
        importedRows: toInsert.length,
        skippedRows: parsed.skipped.length + skippedDup,
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
      `Imported ${toInsert.length} entries into user ${user.email} (batch ${batch.id}).`,
    );
    if (skippedDup) console.log(`Skipped ${skippedDup} duplicates.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
