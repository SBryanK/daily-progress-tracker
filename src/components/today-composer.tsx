"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";
import {
  type OutcomeItem,
  type StructuredEntry,
  type WorkLogRow,
} from "@/lib/structured";
import { todayInJakartaISO } from "@/lib/time";
import { QuickWorklogRow } from "@/components/quick-worklog-row";

/**
 * Owner-only "Today" composer.
 *
 * Sits above the journal feed on the homepage. Captures the new
 * structured daily template:
 *
 *   • Date (defaults to "today" in Asia/Jakarta).
 *   • Work log — repeating { time, note } rows
 *   • Top Things — bulleted list (>= 1 to save).
 *   • Completed / Progressing / Tomorrow — outcome rows that can
 *     optionally chip-link back to one of the Top Things.
 *
 * Save flow:
 *   • POST  /api/progress           when no entry exists for today.
 *   • PATCH /api/progress/{id}      when an entry already exists.
 *   • Cmd/Ctrl + Enter shortcut saves without leaving the page.
 *
 * On success the form stays mounted (no navigation); a toast appears
 * for 1.8s and `router.refresh()` repaints the journal underneath.
 */

type ExistingEntry = {
  id: string;
  date: string;
  taskTitle: string;
  projectName: string | null;
  structured: unknown;
};

const DEFAULT_WORKLOG: WorkLogRow[] = [
  { time: "09:00", note: "" },
  { time: "12:00", note: "" },
  { time: "15:00", note: "" },
  { time: "18:00", note: "" },
];

export function TodayComposer({
  initialEntry,
}: {
  /** The owner's existing structured entry for today, if any. */
  initialEntry: ExistingEntry | null;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const isEdit = !!initialEntry;

  // Hydrate state from the initial entry (edit mode) or from defaults.
  const [date, setDate] = useState<string>(
    initialEntry?.date ?? todayInJakartaISO(),
  );
  const [projectName, setProjectName] = useState<string>(
    initialEntry?.projectName ?? "",
  );
  const initialStructured = useMemo<StructuredEntry>(() => {
    const s = initialEntry?.structured as StructuredEntry | null | undefined;
    if (s && typeof s === "object") {
      return {
        workLog: Array.isArray(s.workLog) && s.workLog.length > 0 ? s.workLog : DEFAULT_WORKLOG,
        topThings: Array.isArray(s.topThings) ? s.topThings : [""],
        completed: Array.isArray(s.completed) ? s.completed : [],
        progressing: Array.isArray(s.progressing) ? s.progressing : [],
        tomorrow: Array.isArray(s.tomorrow) ? s.tomorrow : [],
      };
    }
    return {
      workLog: DEFAULT_WORKLOG,
      topThings: [""],
      completed: [],
      progressing: [],
      tomorrow: [],
    };
  }, [initialEntry]);

  const [workLog, setWorkLog] = useState<WorkLogRow[]>(initialStructured.workLog);
  const [topThings, setTopThings] = useState<string[]>(initialStructured.topThings.length > 0 ? initialStructured.topThings : [""]);
  const [completed, setCompleted] = useState<OutcomeItem[]>(initialStructured.completed);
  const [progressing, setProgressing] = useState<OutcomeItem[]>(initialStructured.progressing);
  const [tomorrow, setTomorrow] = useState<OutcomeItem[]>(initialStructured.tomorrow);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(initialEntry?.id ?? null);

  const formRef = useRef<HTMLFormElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus the first non-trivial input once on mount.
  useEffect(() => {
    if (!isEdit) {
      // Focus the first Top Thing — that's the most useful field for
      // a new daily entry.
      const id = window.setTimeout(() => firstInputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [isEdit]);

  const buildPayload = useCallback(() => {
    const cleanWorklog = workLog
      .map((r) => ({ time: r.time.trim(), note: r.note.trim() }))
      .filter((r) => r.time.length > 0 || r.note.length > 0);
    const cleanTopThings = topThings.map((t) => t.trim()).filter((t) => t.length > 0);
    const cleanOutcomes = (xs: OutcomeItem[]) =>
      xs
        .map((x) => ({ ...x, note: x.note.trim(), assoc: x.assoc?.trim() }))
        .filter((x) => x.note.length > 0);

    return {
      date,
      projectName: projectName.trim() || undefined,
      entryKind: "STRUCTURED" as const,
      structured: {
        workLog: cleanWorklog,
        topThings: cleanTopThings,
        completed: cleanOutcomes(completed),
        progressing: cleanOutcomes(progressing),
        tomorrow: cleanOutcomes(tomorrow),
      },
    };
  }, [workLog, topThings, completed, progressing, tomorrow, date, projectName]);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});

    // Local guard for the at-least-one-Top-Thing rule (Req 3.3) so the
    // user gets feedback before a round-trip.
    const cleanTopThings = topThings.map((t) => t.trim()).filter((t) => t.length > 0);
    if (cleanTopThings.length === 0) {
      setFieldErrors({ topThings: t("today.errors.topThings") });
      setSaving(false);
      return;
    }

    const payload = buildPayload();
    try {
      const url = entryId ? `/api/progress/${entryId}` : "/api/progress";
      const method = entryId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          fieldErrors?: Record<string, string>;
        };
        setError(body.error ?? `Save failed (${res.status})`);
        setFieldErrors(body.fieldErrors ?? {});
        setSaving(false);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        entry?: { id?: string };
      };
      if (json.entry?.id && !entryId) setEntryId(json.entry.id);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      // Refresh the journal underneath us, but DON'T navigate away.
      router.refresh();
      // Auto-clear the toast after a short while.
      window.setTimeout(() => setSavedAt(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  // Cmd/Ctrl + Enter — save without leaving the page.
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-14 pb-6">
      {/*
        The Cmd/Ctrl+Enter shortcut is intentionally bound to the
        form element (the keyboard composition root for this
        composer) and is announced to users via the visible
        “⌘/Ctrl + Enter” hint at the bottom — standard editor pattern.
      */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form
        ref={formRef}
        onSubmit={save}
        onKeyDown={onKeyDown}
        className="rounded-2xl border border-border bg-bg-surface p-4 sm:p-6"
        aria-busy={saving}
      >
        <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {t("today.title")}
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              {t("today.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className="h-9"
            />
            <Input
              type="text"
              value={projectName}
              placeholder="Client / Project (optional)"
              onChange={(e) => setProjectName(e.target.value)}
              aria-label="Client / Project"
              className="h-9 min-w-[180px]"
            />
          </div>
        </header>

        {/* ── Top Things ─────────────────────────────────────────────── */}
        <fieldset className="mb-5">
          <legend className="text-[11px] uppercase tracking-[0.12em] font-semibold text-fg-subtle mb-2">
            {t("section.topThings")}
          </legend>
          <ul className="space-y-2">
            {topThings.map((tt, i) => (
              <li key={`tt-${i}`} className="flex gap-2 items-center">
                <span
                  aria-hidden
                  className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md bg-accent-soft px-1.5 text-[12px] font-semibold text-accent tabular-nums"
                >
                  {i + 1}
                </span>
                <Input
                  ref={i === 0 ? firstInputRef : undefined}
                  value={tt}
                  onChange={(e) => {
                    const next = [...topThings];
                    next[i] = e.target.value;
                    setTopThings(next);
                  }}
                  placeholder={t("today.topThings.placeholder")}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (topThings.length === 1) {
                      setTopThings([""]);
                    } else {
                      setTopThings(topThings.filter((_, j) => j !== i));
                    }
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Remove this Top Thing"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setTopThings([...topThings, ""])}
            className="mt-2 inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border px-3 text-[12.5px] text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("today.topThings.add")}
          </button>
          {fieldErrors.topThings ? (
            <p
              role="alert"
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-danger"
            >
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {fieldErrors.topThings}
            </p>
          ) : null}
        </fieldset>

        {/* ── Outcome columns ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-5">
          <OutcomeFieldset
            title={t("section.completed")}
            value={completed}
            onChange={setCompleted}
            topThings={topThings}
            tone="success"
          />
          <OutcomeFieldset
            title={t("section.progressing")}
            value={progressing}
            onChange={setProgressing}
            topThings={topThings}
            tone="progress"
          />
          <OutcomeFieldset
            title={t("section.tomorrow")}
            value={tomorrow}
            onChange={setTomorrow}
            topThings={topThings}
            tone="future"
          />
        </div>

        {/* ── Work log ─────────────────────────────────────────────── */}
        <fieldset className="mb-4 border-t border-border pt-4">
          <legend className="text-[11px] uppercase tracking-[0.12em] font-semibold text-fg-subtle mb-2 inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" aria-hidden />
            {t("section.workLog")}
          </legend>
          <ul className="space-y-2">
            {workLog.map((row, i) => (
              <li key={`wl-${i}`} className="flex gap-2 items-center">
                <GripVertical
                  className="h-3.5 w-3.5 text-fg-subtle shrink-0"
                  aria-hidden
                />
                <Input
                  type="time"
                  value={row.time}
                  onChange={(e) => {
                    const next = [...workLog];
                    next[i] = { ...next[i]!, time: e.target.value };
                    setWorkLog(next);
                  }}
                  aria-label={t("today.workLog.time")}
                  className="w-[110px]"
                />
                <Input
                  type="text"
                  value={row.note}
                  onChange={(e) => {
                    const next = [...workLog];
                    next[i] = { ...next[i]!, note: e.target.value };
                    setWorkLog(next);
                  }}
                  placeholder={t("today.workLog.note")}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setWorkLog(workLog.filter((_, j) => j !== i))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Remove this row"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              setWorkLog([...workLog, { time: "", note: "" }])
            }
            className="mt-2 inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border px-3 text-[12.5px] text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("today.workLog.add")}
          </button>
        </fieldset>

        {/* ── Footer (errors, save, shortcut) ─────────────────────── */}
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger mb-3"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-fg-subtle">
            {t("today.saveShortcut")}
          </span>
          <div className="flex items-center gap-3">
            {savedAt ? (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-[12.5px] text-success"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {t("today.saved").replace("{time}", savedAt)}
              </span>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                t("today.save")
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Quick-capture row — only shown once today already exists. */}
      {entryId ? (
        <div className="mt-3">
          <QuickWorklogRow entryId={entryId} />
        </div>
      ) : null}

      {/* Subtle backfill link — for legacy time-block entries on
          older days. We always offer the link, but route it through
          /progress/new with a `mode=legacy` flag. */}
      <p className="mt-3 text-right">
        <a
          href={`/progress/new?date=${todayInJakartaISO()}&mode=legacy`}
          className="text-[12px] text-fg-subtle hover:text-fg underline-offset-2 hover:underline"
        >
          {t("today.legacyCta")}
        </a>
      </p>
    </section>
  );
}

/**
 * Internal helper for the three outcome columns. Keeps the parent
 * component readable.
 */
function OutcomeFieldset({
  title,
  value,
  onChange,
  topThings,
  tone,
}: {
  title: string;
  value: OutcomeItem[];
  onChange: (next: OutcomeItem[]) => void;
  topThings: string[];
  tone: "success" | "progress" | "future";
}) {
  const { t } = useLanguage();
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "progress"
        ? "text-accent"
        : "text-fg-muted";

  return (
    <fieldset className="min-w-0">
      <legend
        className={`text-[11px] uppercase tracking-[0.12em] font-semibold mb-2 ${toneClass}`}
      >
        {title}
      </legend>
      <ul className="space-y-2">
        {value.map((it, i) => (
          <li
            key={`oc-${i}`}
            className="rounded-md border border-border bg-bg p-2.5 flex flex-col gap-1.5"
          >
            <Textarea
              rows={2}
              value={it.note}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...next[i]!, note: e.target.value };
                onChange(next);
              }}
              placeholder={t("today.outcomes.note")}
            />
            <div className="flex flex-wrap gap-1.5 items-center">
              <select
                value={it.topThingIndex ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = [...value];
                  next[i] = {
                    ...next[i]!,
                    topThingIndex: v === "" ? undefined : Number(v),
                  };
                  onChange(next);
                }}
                className="h-7 min-w-[120px] flex-1 rounded-md border border-border bg-bg-surface px-2 text-[12px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={t("today.outcomes.linkTo")}
              >
                <option value="">— {t("today.outcomes.linkTo")} —</option>
                {topThings
                  .map((tt, idx) => ({ tt: tt.trim(), idx }))
                  .filter((x) => x.tt.length > 0)
                  .map((x) => (
                    <option key={x.idx} value={x.idx}>
                      #{x.idx + 1} {x.tt.slice(0, 60)}
                    </option>
                  ))}
              </select>
              <Input
                value={it.assoc ?? ""}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = { ...next[i]!, assoc: e.target.value };
                  onChange(next);
                }}
                placeholder={t("today.outcomes.assoc")}
                className="h-7 text-[12px] flex-1 min-w-[120px]"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...value, { note: "" }])}
        className="mt-2 inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-border px-2 text-[12px] text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {t("today.outcomes.add")}
      </button>
    </fieldset>
  );
}
