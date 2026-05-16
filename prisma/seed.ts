import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seeds one or more ADMIN users.
 *
 * The app now uses **usernames** (not emails) as the unique sign-in
 * identifier. For schema-stability we keep the value in the existing
 * `User.email` column — Prisma still treats it as a unique string, so
 * no migration is needed.
 *
 * Preferred config (multi-admin):
 *   ADMIN_USERNAMES="alice,bob"           // or ADMIN_EMAILS (legacy)
 *   ADMIN_PASSWORD="..."
 *
 * Legacy single-admin config (still supported):
 *   SEED_ADMIN_USERNAME / SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME
 *
 * Any previous ADMIN user whose username is NOT in the configured list
 * is demoted to VIEWER so stale credentials can't keep write access.
 * Data is never deleted — only the role flips.
 */
async function main() {
  const rawUsernames =
    process.env.ADMIN_USERNAMES ??
    process.env.ADMIN_EMAILS ??
    process.env.SEED_ADMIN_USERNAME ??
    process.env.SEED_ADMIN_EMAIL ??
    "bryan";
  const usernames = rawUsernames
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (usernames.length === 0) {
    console.error("[seed] ADMIN_USERNAMES is empty. Aborting.");
    process.exit(1);
  }

  const password =
    process.env.ADMIN_PASSWORD ??
    process.env.SEED_ADMIN_PASSWORD ??
    "ChangeMe!123";
  const name = process.env.ADMIN_NAME ?? process.env.SEED_ADMIN_NAME ?? "Admin";
  const passwordHash = await bcrypt.hash(password, 10);

  for (const username of usernames) {
    const user = await prisma.user.upsert({
      where: { email: username },
      update: { name, passwordHash, role: "ADMIN" },
      create: { email: username, name, role: "ADMIN", passwordHash },
    });
    console.log(`[seed] ADMIN ready: ${user.email}  (password: ${password})`);
  }

  const demoted = await prisma.user.updateMany({
    where: { role: "ADMIN", email: { notIn: usernames } },
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
