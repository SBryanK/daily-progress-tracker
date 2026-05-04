import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seeds one or more ADMIN users.
 *
 * Preferred config (multi-admin):
 *   ADMIN_EMAILS="a@x.com,b@x.com"
 *   ADMIN_PASSWORD="..."
 *
 * Legacy single-admin config (still supported):
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
 *
 * Any previous ADMIN user whose email is NOT in ADMIN_EMAILS is demoted to
 * VIEWER so stale credentials can't keep write access. Data is never
 * deleted — only the role flips.
 */
async function main() {
  const rawEmails =
    process.env.ADMIN_EMAILS ??
    process.env.SEED_ADMIN_EMAIL ??
    "bryan@local.test";
  const emails = rawEmails
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("[seed] ADMIN_EMAILS is empty. Aborting.");
    process.exit(1);
  }

  const password =
    process.env.ADMIN_PASSWORD ??
    process.env.SEED_ADMIN_PASSWORD ??
    "ChangeMe!123";
  const name = process.env.ADMIN_NAME ?? process.env.SEED_ADMIN_NAME ?? "Admin";
  const passwordHash = await bcrypt.hash(password, 10);

  for (const email of emails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role: "ADMIN" },
      create: { email, name, role: "ADMIN", passwordHash },
    });
    console.log(`[seed] ADMIN ready: ${user.email}  (password: ${password})`);
  }

  const demoted = await prisma.user.updateMany({
    where: { role: "ADMIN", email: { notIn: emails } },
    data: { role: "VIEWER" },
  });
  if (demoted.count > 0) {
    console.log(
      `[seed] Demoted ${demoted.count} previously-admin account(s) to VIEWER.`,
    );
  }
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    void prisma.$disconnect();
  });
