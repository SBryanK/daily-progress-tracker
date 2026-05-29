// Verification script to check if the May 29, 2026 entry was added successfully

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const entry = await prisma.progressEntry.findFirst({
    where: {
      date: new Date("2026-05-29T00:00:00Z"),
      taskTitle: {
        contains: "Knot sharing session"
      }
    },
    select: {
      id: true,
      date: true,
      taskTitle: true,
      description: true
    }
  });

  if (entry) {
    console.log("✅ Entry successfully added:");
    console.log(`   ID: ${entry.id}`);
    console.log(`   Date: ${entry.date}`);
    console.log(`   Title: ${entry.taskTitle}`);
    console.log("\n✅ Progress tracking system is healthy and functional!");
  } else {
    console.log("❌ Entry not found - please check the script execution");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());