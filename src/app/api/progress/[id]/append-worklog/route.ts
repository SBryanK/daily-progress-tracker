import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminIds } from "@/lib/public";
import { requireAdmin } from "@/lib/require-admin";
import {
  deriveStructuredTitle,
  parseStructured,
  renderStructuredAsDescription,
  sortWorkLog,
  workLogRowSchema,
  type WorkLogRow,
} from "@/lib/structured";
import { logger } from "@/lib/logger";

type RouteCtx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  row: workLogRowSchema,
});

/**
 * Quick-capture endpoint for the homepage composer: append a single
 * `{ time, note }` row to a structured entry's `workLog` array,
 * preserving chronological order.
 *
 * Refuses to operate on legacy entries — the caller (the Owner's quick
 * row UI) is only rendered when today already has a STRUCTURED entry.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const gate = await requireAdmin();
  if (!gate.ok)
    return NextResponse.json(gate.body, { status: gate.status });

  const { id } = await ctx.params;
  const adminIds = await getAdminIds();
  const existing = await prisma.progressEntry.findFirst({
    where: { id, userId: { in: adminIds } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.entryKind !== "STRUCTURED") {
    return NextResponse.json(
      {
        error:
          "Quick-capture only works on structured entries. Open the entry to add a time block.",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "_form"] = issue.message;
    }
    return NextResponse.json(
      { error: "Validation failed", fieldErrors },
      { status: 400 },
    );
  }

  const current = parseStructured(existing.structured);
  if (!current) {
    return NextResponse.json(
      { error: "Existing structured payload is malformed; please edit the entry directly." },
      { status: 409 },
    );
  }

  const merged = {
    ...current,
    workLog: sortWorkLog([...current.workLog, parsed.data.row as WorkLogRow]),
  };

  try {
    const updated = await prisma.progressEntry.update({
      where: { id },
      data: {
        structured: merged as never,
        // Re-render the legacy description body so exports / AI summary
        // see the new row too.
        description: renderStructuredAsDescription(
          merged,
          existing.date.toISOString().slice(0, 10),
        ),
        taskTitle: deriveStructuredTitle(
          merged,
          existing.date.toISOString().slice(0, 10),
        ),
      },
    });
    return NextResponse.json({ entry: updated });
  } catch (err) {
    logger.error("progress.appendWorklog.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to append work-log row" },
      { status: 500 },
    );
  }
}
