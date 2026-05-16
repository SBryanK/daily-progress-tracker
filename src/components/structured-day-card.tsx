"use client";

import Link from "next/link";
import { Pencil, Clock, CheckCircle2, CircleDashed, ArrowRight } from "lucide-react";
import {
  useLanguage,
  formatDateLabel,
  type Lang,
} from "@/components/language-provider";
import type {
  OutcomeItem,
  StructuredEntry,
  WorkLogRow,
} from "@/lib/structured";

/**
 * Structured day card.
 *
 * Renders a single calendar day's STRUCTURED entry with the new
 * template:
 *
 *   • Date header (with the "live" pulse marker when this is the most
 *     recent day in the feed — same look as the legacy card).
 *   • Optional Work-log strip (collapsed list of `HH:mm — note`).
 *   • Top Things — numbered, bold.
 *   • Three columns on >= md screens (Completed / Progressing /
 *     Tomorrow), stacked on mobile. Each item can carry a chip back
 *     to the Top Thing it belongs to.
 *
 * Visitors get the same Chinese fallback rules as the legacy card —
 * we render the canonical English; future bilingual structured fields
 * (e.g. topThingsZh) will plug into this component without changing
 * its API.
 */
export function StructuredDayCard({
  isoDate,
  weekdayLabel,
  taskTitle,
  projectName,
  entryId,
  data,
  isAdmin,
  isLatest = false,
}: {
  isoDate: string;
  weekdayLabel: string;
  taskTitle: string;
  projectName: string | null;
  entryId: string;
  data: StructuredEntry;
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
        <div className="min-w-0">
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
          <h3 className="text-base sm:text-lg font-semibold tracking-tight tabular-nums truncate">
            {formatDateLabel(isoDate, lang)}
          </h3>
          {projectName ? (
            <p className="mt-0.5 text-[12px] text-fg-muted truncate">
              {projectName}
            </p>
          ) : null}
        </div>
        {isAdmin ? (
          <Link
            href={`/progress/${entryId}`}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0"
            aria-label={t("day.edit")}
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {t("day.edit")}
          </Link>
        ) : null}
      </header>

      <article
        className="rounded-xl border border-border bg-bg-surface p-4 sm:p-5"
        aria-label={taskTitle}
      >
        {/* Top Things — the headline grid. */}
        {data.topThings.length > 0 ? (
          <section aria-labelledby={`top-${entryId}`} className="mb-4">
            <h4
              id={`top-${entryId}`}
              className="text-[11px] uppercase tracking-[0.12em] font-semibold text-fg-subtle mb-2"
            >
              {t("section.topThings")}
            </h4>
            <ol className="space-y-1.5">
              {data.topThings.map((tt, i) => (
                <li
                  key={`${entryId}-tt-${i}`}
                  className="flex gap-2.5 items-start text-[14.5px] leading-relaxed"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-md bg-accent-soft px-1.5 text-[11px] font-semibold text-accent tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="text-fg font-medium">{tt}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* Outcome columns — Completed, Progressing, Tomorrow. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <OutcomeColumn
            id={`done-${entryId}`}
            title={t("section.completed")}
            tone="success"
            items={data.completed}
            topThings={data.topThings}
            lang={lang}
          />
          <OutcomeColumn
            id={`prog-${entryId}`}
            title={t("section.progressing")}
            tone="progress"
            items={data.progressing}
            topThings={data.topThings}
            lang={lang}
          />
          <OutcomeColumn
            id={`tom-${entryId}`}
            title={t("section.tomorrow")}
            tone="future"
            items={data.tomorrow}
            topThings={data.topThings}
            lang={lang}
          />
        </div>

        {/* Work log — small, dense list at the bottom so it doesn't
            distract from the headline content but is still available
            for visitors who want the timeline detail. */}
        {data.workLog.length > 0 ? (
          <section
            aria-labelledby={`wl-${entryId}`}
            className="mt-5 border-t border-border pt-4"
          >
            <h4
              id={`wl-${entryId}`}
              className="text-[11px] uppercase tracking-[0.12em] font-semibold text-fg-subtle mb-2 inline-flex items-center gap-1.5"
            >
              <Clock className="h-3 w-3" aria-hidden />
              {t("section.workLog")}
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {data.workLog.map((row, i) => (
                <WorkLogLine key={`${entryId}-wl-${i}`} row={row} />
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  );
}

function OutcomeColumn({
  id,
  title,
  tone,
  items,
  topThings,
  lang,
}: {
  id: string;
  title: string;
  tone: "success" | "progress" | "future";
  items: OutcomeItem[];
  topThings: string[];
  lang: Lang;
}) {
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "progress" ? CircleDashed : ArrowRight;
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "progress"
        ? "text-accent"
        : "text-fg-muted";
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h5
        id={id}
        className={`text-[11px] uppercase tracking-[0.12em] font-semibold mb-2 inline-flex items-center gap-1.5 ${toneClass}`}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {title}
      </h5>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-fg-subtle">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => {
            const linkedTopThing =
              it.topThingIndex != null && topThings[it.topThingIndex]
                ? topThings[it.topThingIndex]
                : null;
            return (
              <li
                key={`${id}-${i}`}
                className="text-[13.5px] leading-relaxed text-fg flex flex-col gap-0.5"
              >
                <span>{it.note}</span>
                {linkedTopThing ? (
                  <span
                    className="inline-flex items-center gap-1 self-start rounded-full bg-bg-muted px-2 py-[1px] text-[10.5px] text-fg-muted max-w-full"
                    title={linkedTopThing}
                    lang={lang}
                  >
                    <span className="font-semibold text-fg-subtle">
                      #{(it.topThingIndex ?? 0) + 1}
                    </span>
                    <span className="truncate">{linkedTopThing}</span>
                  </span>
                ) : it.assoc ? (
                  <span
                    className="inline-flex items-center self-start rounded-full bg-bg-muted px-2 py-[1px] text-[10.5px] text-fg-muted max-w-full"
                    title={it.assoc}
                  >
                    <span className="truncate">{it.assoc}</span>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WorkLogLine({ row }: { row: WorkLogRow }) {
  return (
    <li className="text-[13px] leading-relaxed text-fg-muted flex gap-2 items-baseline">
      <span className="text-fg tabular-nums font-medium shrink-0">
        {row.time}
      </span>
      <span className="text-fg-subtle" aria-hidden>
        —
      </span>
      <span className="min-w-0">{row.note}</span>
    </li>
  );
}
