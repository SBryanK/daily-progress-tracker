"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { minutesBetween, formatDuration } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Languages } from "lucide-react";

export type EntryFormData = {
  id?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  projectName?: string;
  description: string;
  descriptionZh?: string;
  remarks?: string;
  remarksZh?: string;
};

/**
 * Bilingual entry form.
 *
 * Visible fields:
 *   • Date + Start/End time (duration is derived).
 *   • Client / Project (optional) — surfaces the per-client tracking
 *     that Bryan specifically asked for, so every record can belong
 *     to a customer.
 *   • Description (EN)  — canonical body; always required.
 *   • Description (中文) — optional translation; shown to Chinese
 *     readers when they flip the language toggle. Falls back to EN
 *     when empty.
 *   • Comments (EN) + Comments (中文) — same pairing.
 *
 * Title/category/status/priority continue to be handled server-side
 * (title is derived from the first line of the description, status +
 * priority fall back to the server defaults) so the form stays short.
 */
export function EntryForm({
  initial,
  mode,
}: {
  initial: Partial<EntryFormData>;
  mode: "create" | "edit";
}) {
  const router = useRouter();

  const [form, setForm] = useState<EntryFormData>({
    date: initial.date ?? new Date().toISOString().slice(0, 10),
    startTime: initial.startTime ?? "",
    endTime: initial.endTime ?? "",
    projectName: initial.projectName ?? "",
    description: initial.description ?? "",
    descriptionZh: initial.descriptionZh ?? "",
    remarks: initial.remarks ?? "",
    remarksZh: initial.remarksZh ?? "",
    id: initial.id,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const duration = useMemo(
    () => minutesBetween(form.startTime, form.endTime),
    [form.startTime, form.endTime],
  );

  function update<K extends keyof EntryFormData>(
    key: K,
    value: EntryFormData[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    try {
      const payload = {
        date: form.date,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        projectName: form.projectName || undefined,
        description: form.description,
        descriptionZh: form.descriptionZh || undefined,
        remarks: form.remarks || undefined,
        remarksZh: form.remarksZh || undefined,
      };
      const res = await fetch(
        mode === "create" ? "/api/progress" : `/api/progress/${form.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
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
      setSuccess(
        mode === "create" ? "Entry saved." : "Changes saved.",
      );
      // Small delay so the confirmation is visible before we leave the page
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!form.id) return;
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    setSaving(true);
    const res = await fetch(`/api/progress/${form.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Delete failed");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5"
      aria-busy={saving}
    >
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(e) => update("date", e.target.value)}
            error={fieldErrors.date}
          />
          <Input
            label="Start time"
            type="time"
            value={form.startTime ?? ""}
            onChange={(e) => update("startTime", e.target.value)}
            error={fieldErrors.startTime}
          />
          <Input
            label="End time"
            type="time"
            value={form.endTime ?? ""}
            onChange={(e) => update("endTime", e.target.value)}
            hint={
              duration != null
                ? `Duration: ${formatDuration(duration)}`
                : undefined
            }
            error={fieldErrors.endTime}
          />
        </div>

        <div className="mt-4">
          <Input
            label="Client / Project"
            type="text"
            value={form.projectName ?? ""}
            onChange={(e) => update("projectName", e.target.value)}
            placeholder="Customer name, project, or internal initiative"
            hint="Optional — used to group progress per client."
            error={fieldErrors.projectName}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea
            label="What did you work on? (English)"
            required
            rows={8}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Free-form notes — what you did, links, decisions, context…"
            error={fieldErrors.description}
          />
          <Textarea
            label={
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" aria-hidden />
                中文翻译 (Optional)
              </span>
            }
            rows={8}
            value={form.descriptionZh ?? ""}
            onChange={(e) => update("descriptionZh", e.target.value)}
            placeholder="中文记录（可选）——留空则中文读者会看到英文原文。"
            hint="Chinese readers see this when the language toggle is set to 中文."
            error={fieldErrors.descriptionZh}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea
            label="Comments (English)"
            rows={3}
            value={form.remarks ?? ""}
            onChange={(e) => update("remarks", e.target.value)}
            placeholder="Anything else worth noting — side remarks, people to follow up with, reminders…"
            error={fieldErrors.remarks}
          />
          <Textarea
            label={
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" aria-hidden />
                备注 (中文, 可选)
              </span>
            }
            rows={3}
            value={form.remarksZh ?? ""}
            onChange={(e) => update("remarksZh", e.target.value)}
            placeholder="中文备注（可选）"
            error={fieldErrors.remarksZh}
          />
        </div>
      </Card>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-danger/10 border border-danger/25 px-3 py-2 text-sm text-danger"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md bg-success/10 border border-success/25 px-3 py-2 text-sm text-success"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 justify-end">
        {mode === "edit" ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={saving}
          >
            Delete
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving
            ? "Saving…"
            : mode === "create"
              ? "Save entry"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
