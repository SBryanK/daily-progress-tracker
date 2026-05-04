import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeToken } from "@/lib/utils";
import { z } from "zod";

const createSchema = z.object({
  label: z.string().min(1).max(100),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
  projectName: z.string().max(200).optional().or(z.literal("").transform(() => undefined)),
  statusFilter: z.string().optional().or(z.literal("").transform(() => undefined)),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const links = await prisma.shareLink.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ links });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const link = await prisma.shareLink.create({
    data: {
      userId,
      label: data.label,
      token: safeToken(24),
      fromDate: data.fromDate ? new Date(data.fromDate) : null,
      toDate: data.toDate ? new Date(data.toDate + "T23:59:59Z") : null,
      projectName: data.projectName ?? null,
      statusFilter: data.statusFilter ?? null,
      expiresAt: data.expiresInDays
        ? new Date(Date.now() + data.expiresInDays * 86400000)
        : null,
    },
  });
  return NextResponse.json({ link }, { status: 201 });
}
