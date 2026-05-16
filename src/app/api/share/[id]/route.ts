import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
  const { id } = await ctx.params;
  const existing = await prisma.shareLink.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.shareLink.update({ where: { id }, data: { revoked: true } });
  return new Response(null, { status: 204 });
}
