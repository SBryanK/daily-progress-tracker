import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminIds } from "@/lib/public";
import { requireAdmin } from "@/lib/require-admin";
import { todayInJakartaISO } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the authenticated owner's STRUCTURED entry for today (if any)
 * so the homepage composer can hydrate in edit mode without a flash.
 *
 *   • 200  { entry: ProgressEntry }   — today's structured entry exists
 *   • 200  { entry: null }            — no structured entry for today
 *           yet; the composer renders empty
 *   • 401                              — caller is not signed in
 *
 * The endpoint is owner-only because the response includes the full
 * editable payload. Visitors don't need it — they read the journal
 * via /api/entries.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json(gate.body, { status: gate.status });
  }

  const today = todayInJakartaISO();
  const dayStart = new Date(today + "T00:00:00Z");
  const dayEnd = new Date(today + "T23:59:59Z");

  const adminIds = await getAdminIds();
  if (adminIds.length === 0) {
    return NextResponse.json({ entry: null });
  }

  // Pick a STRUCTURED entry on today's date (any admin's). If multiple
  // exist (e.g. a backfilled draft + a fresh one), return the most
  // recent — the composer hydrates it for editing.
  const entry = await prisma.progressEntry.findFirst({
    where: {
      userId: { in: adminIds },
      entryKind: "STRUCTURED",
      date: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ entry });
}
