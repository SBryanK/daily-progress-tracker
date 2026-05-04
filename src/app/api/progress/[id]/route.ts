import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminIds } from "@/lib/public";
import { progressEntrySchema } from "@/lib/validation";
import { minutesBetween } from "@/lib/utils";
import { logger } from "@/lib/logger";

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const entry = await assertAdminOwned(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const derivedTitle =
    (data.taskTitle?.trim() ||
      data.description
        .split(/\r?\n/)
        .map((s) => s.replace(/^[-•\s]+/, "").trim())
        .find((s) => s.length > 0)
        ?.slice(0, 180)) ||
    existing.taskTitle ||
    "Untitled entry";
  try {
    const updated = await prisma.progressEntry.update({
      where: { id },
      data: {
        date: new Date(data.date + "T00:00:00Z"),
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMinutes: minutesBetween(data.startTime, data.endTime) ?? null,
        projectName: data.projectName ?? null,
        taskTitle: derivedTitle,
        category: data.category ?? null,
        description: data.description,
        descriptionZh: data.descriptionZh ?? null,
        status: data.status ?? existing.status,
        priority: data.priority ?? existing.priority,
        blockers: data.blockers ?? null,
        nextAction: data.nextAction ?? null,
        remarks: data.remarks ?? null,
        remarksZh: data.remarksZh ?? null,
        tags: data.tags ?? null,
        relatedLinks: data.relatedLinks ?? null,
      },
    });
    return NextResponse.json({ entry: updated });
  } catch (err) {
    logger.error("progress.update.failed", { err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await assertAdminOwned(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.progressEntry.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
