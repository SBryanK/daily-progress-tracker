"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";

/**
 * Quick-capture row.
 *
 * Rendered under the Today composer once today's structured entry
 * already exists. Lets the Owner add a single { time, note } row to
 * `workLog` without re-opening the full composer — perfect for
 * mid-day "log a quick thought" moments.
 *
 * Calls POST /api/progress/{id}/append-worklog which inserts
 * chronologically.
 */
export function QuickWorklogRow({ entryId }: { entryId: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const canAppend = note.trim().length > 0 && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  async function append(e: React.FormEvent) {
    e.preventDefault();
    if (!canAppend || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/progress/${entryId}/append-worklog`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            row: { time, note: note.trim() },
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setNote("");
      // Bump the time forward by an hour so the next quick capture
      // doesn't repeat the same value — small UX nicety.
      const [h, m] = time.split(":").map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const nextHour = ((h ?? 0) + 1) % 24;
        setTime(`${String(nextHour).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`);
      }
      setSavedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      router.refresh();
      window.setTimeout(() => setSavedAt(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={append}
      className="rounded-xl border border-dashed border-border bg-bg-subtle/40 px-3 py-2.5 flex flex-wrap items-center gap-2"
      aria-label={t("today.quickRow.title")}
    >
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-muted">
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {t("today.quickRow.title")}
      </span>
      <Input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        aria-label="Time"
        className="h-9 w-[110px]"
      />
      <Input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("today.workLog.note")}
        aria-label={t("today.workLog.note")}
        className="h-9 flex-1 min-w-[160px]"
      />
      <Button type="submit" size="sm" disabled={!canAppend || saving}>
        {saving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            …
          </>
        ) : (
          t("today.quickRow.append")
        )}
      </Button>
      {savedAt ? (
        <span
          role="status"
          className="inline-flex items-center gap-1 text-[12px] text-success"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {savedAt}
        </span>
      ) : null}
      {error ? (
        <span
          role="alert"
          className="inline-flex items-center gap-1 text-[12px] text-danger"
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          {error}
        </span>
      ) : null}
    </form>
  );
}
