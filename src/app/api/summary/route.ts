import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminUserIdFilter } from "@/lib/public";
import { generateSummary, type SummaryKind } from "@/lib/ai";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/**
 * Public-readable AI summary endpoint.
 *
 * Anyone can call POST /api/summary to regenerate a summary of the
 * ADMIN-owned progress entries. To protect the upstream Claude quota we
 * apply a light in-memory rate limit (10 requests / 60s / IP).
 */
type Bucket = { count: number; resetAt: number };
const RL_WINDOW_MS = 60_000;
const RL_MAX = 10;
const buckets = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "anon"
  );
}

function rateLimit(ip: string): { ok: boolean; retryMs: number } {
  const now = Date.now();
  const cur = buckets.get(ip);
  if (!cur || cur.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true, retryMs: 0 };
  }
  if (cur.count >= RL_MAX) {
    return { ok: false, retryMs: cur.resetAt - now };
  }
  cur.count += 1;
  return { ok: true, retryMs: 0 };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "Too many requests — please wait a moment and try again.",
        retryMs: rl.retryMs,
      },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    kind?: SummaryKind;
    from?: string;
    to?: string;
  };
  // "manager" was removed from the UI in v2.2 but the underlying AI
  // library still accepts it; keep parsing defensive so an old client
  // posting `kind: "manager"` falls back to weekly instead of crashing.
  const allowed: readonly SummaryKind[] = ["daily", "weekly", "monthly"];
  const kind: SummaryKind = allowed.includes(body.kind as SummaryKind)
    ? (body.kind as SummaryKind)
    : "weekly";

  const today = new Date();
  const toDate = body.to
    ? new Date(body.to + "T23:59:59Z")
    : new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
          23,
          59,
          59,
        ),
      );
  const defaultDays =
    kind === "daily" ? 1 : kind === "weekly" ? 7 : 30;
  const fromDate = body.from
    ? new Date(body.from + "T00:00:00Z")
    : new Date(toDate.getTime() - defaultDays * 86400000);

  const userFilter = await adminUserIdFilter();
  const where: Prisma.ProgressEntryWhereInput = {
    userId: userFilter,
    date: { gte: fromDate, lte: toDate },
  };
  const entries = await prisma.progressEntry.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 500,
  });

  const summary = await generateSummary({
    kind,
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
    entries,
  });

  return NextResponse.json({
    kind,
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
    count: entries.length,
    summary,
    provider: process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : "deterministic",
  });
}
