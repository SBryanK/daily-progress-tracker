import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminIds } from "@/lib/public";
import { requireAdmin } from "@/lib/require-admin";
import { progressEntrySchema } from "@/lib/validation";
import { minutesBetween } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  deriveStructuredTitle,
  normaliseStructured,
  renderStructuredAsDescription,
} from "@/lib/structured";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Any ADMIN user can view/edit/delete any ADMIN-owned entry — the tracker
 * is a single shared journal across every authorised admin account.
 */
async function assertAdminOwned(id: string) {
  const adminIds = await getAdminIds();
  if (adminIds.length === 0) return null;
  return prisma.progressEntry.findFirst({
    where: { id, userId: { in: adminIds } },
  });
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { id } = await ctx.params;
  const entry = await assertAdminOwned(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { id } = await ctx.params;

  const existing = await assertAdminOwned(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      fieldErrors[issue.path.join(".") || "_form"] = issue.message;
    }
    return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
  }
  const data = parsed.data;
  const isStructured =
    data.entryKind === "STRUCTURED" || data.structured != null;

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
      existing.taskTitle ||
      "Untitled entry";
    descriptionBody = fallbackDescription;
  }

  try {
    const updated = await prisma.progressEntry.update({
      where: { id },
      data: {
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
        status: data.status ?? existing.status,
        priority: data.priority ?? existing.priority,
        blockers: data.blockers ?? null,
        nextAction: data.nextAction ?? null,
        remarks: data.remarks ?? null,
        remarksZh: data.remarksZh ?? null,
        tags: data.tags ?? null,
        relatedLinks: data.relatedLinks ?? null,
        entryKind: isStructured ? "STRUCTURED" : "LEGACY",
        structured: (structuredJson ?? null) as never,
      },
    });
    return NextResponse.json({ entry: updated });
  } catch (err) {
    logger.error("progress.update.failed", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { id } = await ctx.params;
  const existing = await assertAdminOwned(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.progressEntry.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
