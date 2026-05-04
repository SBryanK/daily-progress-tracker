"use client";

import Link from "next/link";
import { Pencil, Clock } from "lucide-react";
import {
  useLanguage,
  formatDateLabel,
} from "@/components/language-provider";

type Entry = {
  id: string;
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

/**
 * Day card — title-less rendering of a single day.
 *
 * Each entry shows the time range (when present) and the full
 * description. No task title, no project/category, no status badges —
 * keeps the look closest to the original Excel tracker.
 *
 * v2.1 changes:
 *   • The vertical rail is no longer drawn here. The parent journal
 *     feed now paints ONE continuous line per month section so it
 *     never appears broken between days.
 *   • `isLatest` switches the marker dot from a hollow ring to a
 *     solid, filled accent disc with two expanding rings behind it
 *     ("live" indicator). Backed by the `live-dot-ring` CSS keyframe.
 *   • Description + remarks render their Chinese translation when
 *     the language toggle is set to 中文 AND a translation exists;
 *     otherwise the canonical English body is shown so no content is
 *     ever hidden from a viewer.
 */
export function DayEntriesCard({
  isoDate,
  weekdayLabel,
  entries,
  isAdmin,
  isLatest = false,
}: {
  isoDate: string;
  weekdayLabel: string;
  entries: Entry[];
  isAdmin: boolean;
  isLatest?: boolean;
}) {
  const { lang, t } = useLanguage();
  return (
    <div className="relative pl-6 sm:pl-8">
      {/* Marker dot — sits on top of the rail drawn by the parent. */}
      <div
        aria-hidden
        className="absolute left-[6px] sm:left-[10px] top-2 h-2.5 w-2.5 z-[1]"
      >
        {isLatest ? (
          <>
            {/* Two layered pulse rings, offset by 1s so the "heartbeat"
                never looks uniform. */}
            <span className="absolute inset-0 rounded-full bg-accent/40 live-dot-ring" />
            <span
              className="absolute inset-0 rounded-full bg-accent/30 live-dot-ring"
              style={{ animationDelay: "1s" }}
            />
            <span className="relative block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--bg-subtle)]" />
          </>
        ) : (
          <span className="block h-2.5 w-2.5 rounded-full bg-bg border-2 border-accent" />
        )}
      </div>

      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
            {weekdayLabel}
            {isLatest ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-[1px] text-[10px] font-semibold uppercase tracking-[0.1em] text-accent normal-case">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse"
                />
                {t("day.live")}
              </span>
            ) : null}
          </p>
          <h3 className="text-base sm:text-lg font-semibold tracking-tight tabular-nums">
            {formatDateLabel(isoDate, lang)}
          </h3>
        </div>
      </header>

      <ul className="space-y-3">
        {entries.map((e) => {
          const body =
            lang === "zh" && e.descriptionZh && e.descriptionZh.trim()
              ? e.descriptionZh
              : e.description;
          const comment =
            lang === "zh" && e.remarksZh && e.remarksZh.trim()
              ? e.remarksZh
              : e.remarks;
          return (
            <li
              key={e.id}
          className="rounded-xl border border-border bg-bg-surface hover:border-border-strong transition-colors"
            >
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  {e.startTime ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-fg-muted tabular-nums">
                      <Clock className="h-3 w-3" aria-hidden />
                      {e.startTime}
                      {e.endTime ? ` – ${e.endTime}` : ""}
                    </span>
                  ) : (
                    <span className="text-[12px] text-fg-subtle">—</span>
                  )}
                  {isAdmin ? (
                    <Link
                      href={`/progress/${e.id}`}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={t("day.edit")}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      {t("day.edit")}
                    </Link>
                  ) : null}
                </div>

                <p className="prose-entry text-[14.5px] leading-relaxed text-fg whitespace-pre-wrap">
                  {body}
                </p>

                {comment ? (
                  <p className="mt-3 text-[13px] text-fg-muted prose-entry border-l-2 border-border pl-3">
                    <span className="text-fg-subtle">
                      {t("day.comments")} ·{" "}
                    </span>
                    {comment}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
