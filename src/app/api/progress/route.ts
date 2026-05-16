import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { progressEntrySchema } from "@/lib/validation";
import { minutesBetween } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  deriveStructuredTitle,
  normaliseStructured,
  renderStructuredAsDescription,
} from "@/lib/structured";

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;

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
  const isStructured =
    data.entryKind === "STRUCTURED" || data.structured != null;

  // Pre-compute the canonical title + description body.
  //   • Structured: title from the first Top Thing (Req 3.5 / A9);
  //     description is the plain-text projection of the structured
  //     payload so legacy surfaces (export, AI summary) keep working.
  //   • Legacy: keep the existing first-line-of-description heuristic.
  let derivedTitle: string;
  let descriptionBody: string;
  let structuredJson: unknown = null;

  if (isStructured && data.structured) {
    const norm = normaliseStructured(data.structured);
    structuredJson = norm;
    derivedTitle = deriveStructuredTitle(norm, data.date);
    descriptionBody =
      data.description?.trim() ||
      renderStructuredAsDescription(norm, data.date);
  } else {
    const fallbackDescription = data.description ?? "";
    derivedTitle =
      (data.taskTitle?.trim() ||
        fallbackDescription
          .split(/\r?\n/)
          .map((s) => s.replace(/^[-•\s]+/, "").trim())
          .find((s) => s.length > 0)
          ?.slice(0, 180)) ||
      "Untitled entry";
    descriptionBody = fallbackDescription;
  }

  try {
    const entry = await prisma.progressEntry.create({
      data: {
        userId,
        date: new Date(data.date + "T00:00:00Z"),
        startTime: isStructured ? null : data.startTime ?? null,
        endTime: isStructured ? null : data.endTime ?? null,
        durationMinutes: isStructured
          ? null
          : minutesBetween(data.startTime, data.endTime) ?? null,
        projectName: data.projectName ?? null,
        taskTitle: derivedTitle,
        category: data.category ?? null,
        description: descriptionBody,
        descriptionZh: data.descriptionZh ?? null,
        status: data.status ?? "IN_PROGRESS",
        priority: data.priority ?? "MEDIUM",
        blockers: data.blockers ?? null,
        nextAction: data.nextAction ?? null,
        remarks: data.remarks ?? null,
        remarksZh: data.remarksZh ?? null,
        tags: data.tags ?? null,
        relatedLinks: data.relatedLinks ?? null,
        entryKind: isStructured ? "STRUCTURED" : "LEGACY",
        // Prisma's Json column type accepts unknown; we feed in a value
        // that Zod has already validated, so the cast is safe.
        structured: (structuredJson ?? undefined) as never,
      },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    logger.error("progress.create.failed", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 500);
  const entries = await prisma.progressEntry.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: limit,
  });
  return NextResponse.json({ entries });
}
