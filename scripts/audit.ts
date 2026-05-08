import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.progressEntry.findMany({
    where: {
      date: {
        gte: new Date("2025-06-01T00:00:00Z"),
        lte: new Date("2026-05-31T23:59:59Z"),
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: { date: true, startTime: true, taskTitle: true, sourceRow: true },
  });

  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = r.date.toISOString().slice(0, 10);
    let arr = byDate.get(d);
    if (!arr) {
      arr = [] as unknown as typeof rows;
      byDate.set(d, arr);
    }
    arr.push(r);
  }

  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const [d, arr] of [...byDate.entries()].sort()) {
    const wd = WD[new Date(d + "T00:00:00Z").getUTCDay()];
    const first = arr[0]!;
    console.log(
      `${d} ${wd} n=${arr.length.toString().padStart(2)} src=${(first.sourceRow ?? 0)
        .toString()
        .padStart(4)} | ${first.taskTitle.slice(0, 72)}`,
    );
  }
  console.log(`DAYS: ${byDate.size}  ROWS: ${rows.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
