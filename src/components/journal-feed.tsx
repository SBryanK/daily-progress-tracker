"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DayEntriesCard } from "@/components/day-entries-card";
import { StructuredDayCard } from "@/components/structured-day-card";
import {
  useLanguage,
  formatMonthLabel,
  formatWeekday,
} from "@/components/language-provider";
import { parseStructured } from "@/lib/structured";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";

type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  taskTitle: string;
  description: string;
  descriptionZh: string | null;
  projectName: string | null;
  category: string | null;
  remarks: string | null;
  remarksZh: string | null;
  durationMinutes: number | null;
  entryKind?: string | null;
  structured?: unknown;
};

type FeedPayload = {
  entries: Entry[];
  nextCursor: string | null;
};

/**
 * Infinite-scroll journal feed.
 *
 * v3 (2026-05-16) adds polymorphic day rendering:
 *   • Days that contain at least one STRUCTURED entry are rendered with
 *     <StructuredDayCard /> at the top.
 *   • Legacy time-blocked entries on the same day collapse into a
 *     "+ N time-blocked entries" disclosure beneath, so a structured
 *     summary always wins the visitor's attention.
 *   • Days that contain ONLY legacy entries continue to render exactly
 *     as before — visitors who already love that look see no change.
 *
 * Scroll mechanics, sentinel + IntersectionObserver, and the per-month
 * sticky header / continuous rail are all unchanged.
 */
export function JournalFeed({
  initialEntries,
  initialNextCursor,
  isAdmin,
  pageSize = 20,
  latestDate,
}: {
  initialEntries: Entry[];
  initialNextCursor: string | null;
  isAdmin: boolean;
  pageSize?: number;
  /** The most-recent YYYY-MM-DD in the feed — painted as the pulsing live dot. */
  latestDate?: string | null;
}) {
  const { lang, t } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(
    new Set(initialEntries.map((e) => e.id)),
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/entries?cursor=${encodeURIComponent(cursor)}&limit=${pageSize}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FeedPayload;
      const fresh = data.entries.filter((e) => !seenRef.current.has(e.id));
      for (const f of fresh) seenRef.current.add(f.id);
      setEntries((prev) => [...prev, ...fresh]);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, pageSize]);

  useEffect(() => {
    if (!cursor) return;
    const el = sentinelRef.current;
    const root = scrollerRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      (entriesObs) => {
        for (const entry of entriesObs) {
          if (entry.isIntersecting) {
            void loadMore();
          }
        }
      },
      {
        root,
        rootMargin: "400px 0px",
        threshold: 0,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !cursor) return;
    function onScroll() {
      if (!root) return;
      const { scrollTop, scrollHeight, clientHeight } = root;
      if (scrollHeight - (scrollTop + clientHeight) < 400) {
        void loadMore();
      }
    }
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [cursor, loadMore]);

  // Group by month → date → entries[].
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  const byMonth = new Map<string, string[]>();
  for (const date of byDate.keys()) {
    const ym = date.slice(0, 7);
    const arr = byMonth.get(ym) ?? [];
    arr.push(date);
    byMonth.set(ym, arr);
  }

  const computedLatest = entries.length > 0 ? entries[0]!.date : null;
  const effectiveLatest = latestDate ?? computedLatest;

  return (
    <div className="journal-shell rounded-2xl border border-border bg-bg-subtle/40 overflow-hidden">
      <div className="scroll-fade">
        <div
          ref={scrollerRef}
          role="region"
          aria-label={t("journal.regionLabel")}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="thin-scrollbar overflow-y-auto pt-0 pb-8 h-[60vh] md:h-[72vh] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        >
          <div className="space-y-14">
            {[...byMonth.entries()].map(([ym, dates]) => (
              <section
                key={ym}
                aria-labelledby={`m-${ym}`}
                className="relative"
              >
                <h2
                  id={`m-${ym}`}
                  className="sticky top-0 z-20 bg-bg-subtle px-4 sm:px-6 lg:px-8 xl:px-10 pt-5 pb-4 text-xl sm:text-2xl font-bold tracking-tight text-fg shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                >
                  {formatMonthLabel(ym, lang)}
                </h2>
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-[27px] sm:left-[39px] lg:left-[47px] xl:left-[55px] top-[76px] bottom-4 w-px bg-border"
                />

                <div className="px-4 sm:px-6 lg:px-8 xl:px-10 pt-2">
                  <div className="space-y-8 relative">
                    {dates.map((d) => (
                      <DayBlock
                        key={d}
                        anchorId={`day-${d}`}
                        isoDate={d}
                        weekdayLabel={formatWeekday(d, lang)}
                        entries={byDate.get(d) ?? []}
                        isAdmin={isAdmin}
                        isLatest={d === effectiveLatest}
                      />
                    ))}
                  </div>
                </div>
              </section>
            ))}

            <div className="flex justify-center py-6" aria-live="polite">
              {cursor ? (
                <>
                  <div ref={sentinelRef} aria-hidden className="h-px w-px" />
                  {loading ? (
                    <span className="inline-flex items-center gap-2 text-sm text-fg-muted">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {t("journal.loadingMore")}
                    </span>
                  ) : error ? (
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg-surface px-3 text-sm hover:bg-bg-muted"
                    >
                      {error} — {t("journal.retry")}
                    </button>
                  ) : (
                    <span className="text-xs text-fg-subtle">
                      {t("journal.keepScrolling")}
                    </span>
                  )}
                </>
              ) : entries.length > 0 ? (
                <span className="text-xs text-fg-subtle">
                  {t("journal.reachedStart")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inner component that decides whether to render a day with the new
 * structured card, the legacy time-blocked card, or both (with the
 * legacy entries collapsed under a disclosure).
 *
 * Extracted out of the main feed so the disclosure state can live on
 * a per-day basis (each day card is its own React subtree).
 */
function DayBlock({
  anchorId,
  isoDate,
  weekdayLabel,
  entries,
  isAdmin,
  isLatest,
}: {
  anchorId: string;
  isoDate: string;
  weekdayLabel: string;
  entries: Entry[];
  isAdmin: boolean;
  isLatest: boolean;
}) {
  const { t } = useLanguage();
  // A day "has structured" content when at least one entry on it has
  // entryKind === "STRUCTURED" AND its `structured` JSON parses cleanly.
  const structuredEntries: Array<Entry & { parsed: NonNullable<ReturnType<typeof parseStructured>> }> = [];
  const legacyEntries: Entry[] = [];
  for (const e of entries) {
    if (e.entryKind === "STRUCTURED") {
      const parsed = parseStructured(e.structured);
      if (parsed) {
        structuredEntries.push({ ...e, parsed });
        continue;
      }
    }
    legacyEntries.push(e);
  }

  const [showLegacy, setShowLegacy] = useState(false);

  // Pure-legacy day → render exactly as before.
  if (structuredEntries.length === 0) {
    return (
      <div id={anchorId} style={{ scrollMarginTop: 80 }}>
        <DayEntriesCard
          isoDate={isoDate}
          weekdayLabel={weekdayLabel}
          entries={legacyEntries}
          isAdmin={isAdmin}
          isLatest={isLatest}
        />
      </div>
    );
  }

  // Structured (possibly with legacy on the same day).
  const disclosureKey =
    legacyEntries.length === 1
      ? "section.legacy.disclosure_one"
      : "section.legacy.disclosure_other";
  const disclosureLabel = t(disclosureKey).replace(
    "{n}",
    String(legacyEntries.length),
  );

  return (
    <div
      id={anchorId}
      style={{ scrollMarginTop: 80 }}
      className="space-y-4"
    >
      {structuredEntries.map((e, idx) => (
        <StructuredDayCard
          key={e.id}
          isoDate={isoDate}
          weekdayLabel={idx === 0 ? weekdayLabel : ""}
          taskTitle={e.taskTitle}
          projectName={e.projectName}
          entryId={e.id}
          data={e.parsed}
          isAdmin={isAdmin}
          // Only the FIRST structured entry of the latest day pulses, so
          // we don't paint two live dots stacked on top of each other.
          isLatest={isLatest && idx === 0}
        />
      ))}

      {legacyEntries.length > 0 ? (
        <div className="pl-6 sm:pl-8">
          <button
            type="button"
            onClick={() => setShowLegacy((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-2 py-1 -ml-2"
            aria-expanded={showLegacy}
          >
            {showLegacy ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {disclosureLabel}
          </button>
          {showLegacy ? (
            <div className="mt-2">
              <DayEntriesCard
                isoDate={isoDate}
                weekdayLabel=""
                entries={legacyEntries}
                isAdmin={isAdmin}
                isLatest={false}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

