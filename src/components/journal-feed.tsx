"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DayEntriesCard } from "@/components/day-entries-card";
import {
  useLanguage,
  formatMonthLabel,
  formatWeekday,
} from "@/components/language-provider";
import { Loader2 } from "lucide-react";

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
};

type FeedPayload = {
  entries: Entry[];
  nextCursor: string | null;
};

/**
 * Infinite-scroll journal feed rendered inside its OWN scroll container.
 *
 * Structural change (v2.1): the vertical "spine" rail used to be drawn
 * per-day (inside each DayEntriesCard), which meant the `space-y-8`
 * between days left a visible gap — the rail looked broken. The rail is
 * now drawn once per MONTH section as an absolutely-positioned element
 * spanning the entire section, so it reads as a single unbroken line
 * from the first entry of the month to the last. DayEntriesCard only
 * paints its own dot now.
 *
 * The IntersectionObserver is scoped to `root: scrollerRef.current`, so
 * the sentinel fires as it approaches the container's bottom edge — not
 * the viewport's. We still dedupe by id and guard against double-fire
 * while a fetch is already in flight.
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
        root, // observe relative to the scroll container, not the viewport
        rootMargin: "400px 0px", // start loading before the bottom edge
        threshold: 0,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  // Fallback for engines that fire IO slowly on fast flings: also watch
  // the container's native scroll and trigger loadMore when near bottom.
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

  // Regroup all loaded entries into month → date → entries[]
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

  // Determine the overall latest date present in the loaded feed. We
  // prefer the server-provided `latestDate` (correct on first paint even
  // when JS hasn't hydrated) but fall back to the client-side max so
  // the marker still moves when the user adds a brand-new entry and the
  // list re-renders.
  const computedLatest = entries.length > 0 ? entries[0]!.date : null;
  const effectiveLatest = latestDate ?? computedLatest;

  return (
    <div className="journal-shell rounded-2xl border border-border bg-bg-subtle/40 overflow-hidden">
      {/*
        Outer wrapper keeps the border + rounded corners + fade mask.
        The INNER div is the actual scroll region — separating them means
        the WebKit scrollbar track doesn't get cut off by the mask.
      */}
      <div className="scroll-fade">
        <div
          ref={scrollerRef}
          role="region"
          aria-label={t("journal.regionLabel")}
          // Allow keyboard users to focus the region and scroll it with
          // arrow keys / page-down. The a11y linter flags tabIndex on a
          // non-interactive element, but a focusable scroll region is the
          // WAI-ARIA recommended pattern for this exact case.
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
                {/* Month header — sticks flush to the TOP of the scroll
                    container so there is NO visible gap between the
                    card border and the pinned header. Uses a fully-
                    opaque background + soft shadow so content scrolling
                    underneath never bleeds through. Horizontal padding
                    matches the scroller's content padding via the
                    negative margins that stretch the header to the
                    card's inner edges. */}
                <h2
                  id={`m-${ym}`}
                  className="sticky top-0 z-20 bg-bg-subtle px-4 sm:px-6 lg:px-8 xl:px-10 pt-5 pb-4 text-xl sm:text-2xl font-bold tracking-tight text-fg shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                >
                  {formatMonthLabel(ym, lang)}
                </h2>

                {/* Continuous rail — drawn ONCE per section so it never
                    appears broken between consecutive days. Positioned
                    to pass EXACTLY through the centre of each day's
                    marker dot. Dot centre X = card.paddingLeft + dot.left
                    + dot.width/2, i.e. 16+6+5=27 (mobile), 24+10+5=39
                    (sm), 32+10+5=47 (lg), 40+10+5=55 (xl). */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-[27px] sm:left-[39px] lg:left-[47px] xl:left-[55px] top-[76px] bottom-4 w-px bg-border"
                />

                <div className="px-4 sm:px-6 lg:px-8 xl:px-10 pt-2">
                  <div className="space-y-8 relative">
                    {dates.map((d) => (
                      <DayEntriesCard
                        key={d}
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

            {/* Sentinel + status row */}
            <div className="flex justify-center py-6" aria-live="polite">
              {cursor ? (
                <>
                  <div
                    ref={sentinelRef}
                    aria-hidden
                    className="h-px w-px"
                  />
                  {loading ? (
                    <span className="inline-flex items-center gap-2 text-sm text-fg-muted">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden
                      />
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

