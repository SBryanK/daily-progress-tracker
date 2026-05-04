// Helpers for public (read-only) surfaces.
//
// The site is public-by-default: anonymous visitors can READ every progress
// entry that belongs to an ADMIN user. These helpers centralise that filter
// and cache the admin userId list for a few seconds so the landing page
// doesn't re-query on every pagination click.
import { prisma } from "@/lib/prisma";

let cached: { ids: string[]; fetchedAt: number } | null = null;
const TTL_MS = 30_000;

/**
 * Returns every ADMIN user's id. Cached for 30 seconds. Falls back to an
 * empty array if the seed has never been run — callers should treat that as
 * "no data yet".
 */
export async function getAdminIds(): Promise<string[]> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < TTL_MS) return cached.ids;
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const ids = admins.map((a) => a.id);
  cached = { ids, fetchedAt: now };
  return ids;
}

/** Invalidate the admin-ids cache (call from seed / admin routes). */
export function invalidateAdminIdsCache(): void {
  cached = null;
}

/**
 * Prisma filter clause that scopes a query to any admin-owned row.
 * Use it instead of `userId: session.user.id` on public pages.
 */
export async function adminUserIdFilter(): Promise<{ in: string[] }> {
  const ids = await getAdminIds();
  // Use an unusable sentinel so the query reliably returns [] when no admin
  // exists yet, rather than matching every row.
  return { in: ids.length ? ids : ["__no_admins__"] };
}
