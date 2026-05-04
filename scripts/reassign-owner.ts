import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * One-shot util: reassigns every ProgressEntry / ImportBatch / ShareLink
 * row that belongs to a user who is no longer in ADMIN_EMAILS to the
 * current primary ADMIN_EMAILS[0]. Safe to re-run.
 *
 * Use this after you change ADMIN_EMAILS but already have data seeded or
 * imported under the old admin email.
 *
 * Usage:
 *   npx tsx scripts/reassign-owner.ts
 */
async function main() {
  const prisma = new PrismaClient();

  const rawEmails =
    process.env.ADMIN_EMAILS ??
    process.env.SEED_ADMIN_EMAIL ??
    "";
  const emails = rawEmails
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) {
    console.error("[reassign] ADMIN_EMAILS is empty.");
    process.exit(1);
  }

  const primary = emails[0]!;
  const primaryUser = await prisma.user.findUnique({ where: { email: primary } });
  if (!primaryUser) {
    console.error(`[reassign] No user for ${primary}. Run "npm run db:seed" first.`);
    process.exit(1);
  }
  const admins = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const adminIds = admins.map((a) => a.id);

  const entryCount = await prisma.progressEntry.count({
    where: { userId: { notIn: adminIds } },
  });
  if (entryCount === 0) {
    console.log("[reassign] Nothing to do — every entry already belongs to an admin.");
    await prisma.$disconnect();
    return;
  }

  const entries = await prisma.progressEntry.updateMany({
    where: { userId: { notIn: adminIds } },
    data: { userId: primaryUser.id },
  });
  const batches = await prisma.importBatch.updateMany({
    where: { userId: { notIn: adminIds } },
    data: { userId: primaryUser.id },
  });
  const shares = await prisma.shareLink.updateMany({
    where: { userId: { notIn: adminIds } },
    data: { userId: primaryUser.id },
  });

  console.log(
    `[reassign] Moved ${entries.count} entries, ${batches.count} import batches, ${shares.count} share links to ${primary}.`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[reassign] failed:", err);
  process.exit(1);
});
