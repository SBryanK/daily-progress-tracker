import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { progressEntrySchema } from "@/lib/validation";
import { minutesBetween } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = progressEntrySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
  }

  const data = parsed.data;
  // Derive a title from the first line of the description when one isn't
  // supplied — keeps the DB column populated while the user-facing form
  // no longer asks for it.
  const derivedTitle =
    (data.taskTitle?.trim() ||
      data.description
        .split(/\r?\n/)
        .map((s) => s.replace(/^[-•\s]+/, "").trim())
        .find((s) => s.length > 0)
        ?.slice(0, 180)) ||
    "Untitled entry";
  try {
    const entry = await prisma.progressEntry.create({
      data: {
        userId,
        date: new Date(data.date + "T00:00:00Z"),
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMinutes: minutesBetween(data.startTime, data.endTime) ?? null,
        projectName: data.projectName ?? null,
        taskTitle: derivedTitle,
        category: data.category ?? null,
        description: data.description,
        descriptionZh: data.descriptionZh ?? null,
        status: data.status ?? "IN_PROGRESS",
        priority: data.priority ?? "MEDIUM",
        blockers: data.blockers ?? null,
        nextAction: data.nextAction ?? null,
        remarks: data.remarks ?? null,
        remarksZh: data.remarksZh ?? null,
        tags: data.tags ?? null,
        relatedLinks: data.relatedLinks ?? null,
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    logger.error("progress.create.failed", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 500);
  const entries = await prisma.progressEntry.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: limit,
  });
  return NextResponse.json({ entries });
}
