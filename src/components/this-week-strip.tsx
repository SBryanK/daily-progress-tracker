"use client";

import Link from "next/link";
import { CheckCircle2, CircleDashed } from "lucide-react";
import {
  useLanguage,
  formatDateLabel,
  formatWeekday,
} from "@/components/language-provider";

export type ThisWeekItem = {
  isoDate: string;
  topThing: string | null;
  completedCount: number;
  progressingCount: number;
};

/**
 * Visitor "This week" strip.
 *
 * Rendered above the journal feed for visitors when at least one
 * STRUCTURED entry exists. Each row links to `#day-<iso>` so a click
 * scroll-snaps to the matching day card in the journal beneath.
 *
 * On mobile the strip becomes horizontally scrollable; on desktop it
 * stacks as a tidy column-of-rows that hugs the right edge of the
 * journal section.
 */
export function ThisWeekStrip({ days }: { days: ThisWeekItem[] }) {
  const { lang, t } = useLanguage();
  if (days.length === 0) return null;

  return (
    <section
      aria-labelledby="this-week-title"
      className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-14 pb-4"
    >
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2
            id="this-week-title"
            className="text-base sm:text-lg font-semibold tracking-tight"
          >
            {t("thisWeek.title")}
          </h2>
          <p className="text-[12px] text-fg-muted">
            {t("thisWeek.subtitle")}
          </p>
        </div>
      </header>

      <ul className="flex md:grid md:grid-cols-5 gap-2 overflow-x-auto md:overflow-visible -mx-1 px-1 pb-1 thin-scrollbar">
        {days.map((d) => (
          <li
            key={d.isoDate}
            className="shrink-0 md:shrink"
            style={{ minWidth: 220 }}
          >
            <Link
              href={`#day-${d.isoDate}`}
              className="group block h-full rounded-xl border border-border bg-bg-surface p-3 hover:border-border-strong hover:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
            >
              <p className="text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">
                {formatWeekday(d.isoDate, lang)}
              </p>
              <p className="text-[13px] font-semibold tabular-nums">
                {formatDateLabel(d.isoDate, lang)}
              </p>
              <p className="mt-2 text-[13px] text-fg line-clamp-2 min-h-[2.5em]">
                {d.topThing ?? <span className="text-fg-subtle">—</span>}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[11.5px] text-fg-muted">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2
                    className="h-3 w-3 text-success"
                    aria-hidden
                  />
                  {d.completedCount} {t("thisWeek.completed")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CircleDashed
                    className="h-3 w-3 text-accent"
                    aria-hidden
                  />
                  {d.progressingCount} {t("thisWeek.progressing")}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
