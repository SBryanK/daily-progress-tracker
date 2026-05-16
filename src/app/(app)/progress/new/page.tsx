import { EntryForm } from "@/components/entry-form";

/**
 * /progress/new — legacy backfill route.
 *
 * Bryan's main daily logging now happens in the homepage's
 * <TodayComposer /> (structured template). This route is kept around
 * to backfill OLDER days in the original time-blocked format — the
 * "legacy" link inside the composer points here.
 *
 * Query params:
 *   • date=YYYY-MM-DD   — pre-populates the date field. Required by
 *     Req 4.5 so the backfill flow always lands on the day the user
 *     clicked from.
 *   • mode=legacy       — accepted for forward compatibility; the
 *     EntryForm already only supports the legacy time-block layout,
 *     so it's a no-op today.
 */
export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const initialDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          New entry (legacy time-blocks)
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Backfill an older day in the original Excel-style format.
          Today&rsquo;s notes live on the homepage composer.
        </p>
      </header>
      <EntryForm mode="create" initial={initialDate ? { date: initialDate } : {}} />
    </div>
  );
}
