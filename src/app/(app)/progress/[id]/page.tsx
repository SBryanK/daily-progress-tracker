import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminIds } from "@/lib/public";
import { EntryForm } from "@/components/entry-form";
import { formatDateISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Any ADMIN can edit any admin-owned entry — the journal is a single
  // shared log. Middleware already enforces that an authenticated ADMIN
  // session is present for this path.
  await auth();
  const adminIds = await getAdminIds();
  const entry = await prisma.progressEntry.findFirst({
    where: { id, userId: { in: adminIds } },
  });
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Edit entry
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Logged on {entry.date.toISOString().slice(0, 10)}
          {entry.sourceSheet
            ? ` · Imported from “${entry.sourceSheet}”`
            : ""}
        </p>
      </header>
      <EntryForm
        mode="edit"
        initial={{
          id: entry.id,
          date: formatDateISO(entry.date),
          startTime: entry.startTime ?? "",
          endTime: entry.endTime ?? "",
          projectName: entry.projectName ?? "",
          description: entry.description,
          descriptionZh: entry.descriptionZh ?? "",
          remarks: entry.remarks ?? "",
          remarksZh: entry.remarksZh ?? "",
        }}
      />
    </div>
  );
}
