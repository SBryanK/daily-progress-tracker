"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";

type PreviewEntry = {
  sourceSheet: string;
  sourceRow: number;
  date: string;
  startTime?: string;
  endTime?: string;
  taskTitle: string;
  description: string;
};

type PreviewResp = {
  dryRun: true;
  filename: string;
  sheets: string[];
  template: Record<string, "WEEKLY_BLOCK" | "OLD_DAILY" | "NEW_DAILY" | "UNKNOWN">;
  totalParsed: number;
  skipped: number;
  preview: PreviewEntry[];
  skippedSample: { sheet: string; row: number; reason: string }[];
};

type CommitResp = {
  dryRun: false;
  batchId: string;
  filename: string;
  imported: number;
  skipped: number;
  total: number;
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [committed, setCommitted] = useState<CommitResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setCommitted(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dryRun", "true");
    const res = await fetch("/api/import", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Preview failed (${res.status})`);
      return;
    }
    setPreview((await res.json()) as PreviewResp);
  }

  async function onCommit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dryRun", "false");
    const res = await fetch("/api/import", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Import failed (${res.status})`);
      return;
    }
    setCommitted((await res.json()) as CommitResp);
    setPreview(null);
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Import Excel</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Upload your existing tracker (<span className="font-mono">.xlsx</span>). Both the old
          (column-per-person) and new (time-sliced) templates are supported. Preview first, then commit.
        </p>
      </header>

      <Card>
        <form onSubmit={onPreview} className="flex flex-col gap-4">
          <label className="block">
            <span className="text-sm font-medium">Excel file</span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="file"
                accept=".xlsx,.xls"
                aria-label="Upload Excel file"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setCommitted(null);
                }}
                className="block w-full text-sm text-fg file:mr-3 file:h-10 file:px-4 file:rounded-lg file:border-0 file:bg-accent file:text-accent-fg file:font-medium hover:file:bg-accent-hover"
              />
            </div>
          </label>
          {file ? (
            <p className="text-sm text-fg-muted flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" aria-hidden /> {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" disabled={!file || loading}>
              <Upload className="h-4 w-4" aria-hidden /> {loading ? "Parsing..." : "Preview"}
            </Button>
          </div>
        </form>
      </Card>

      {error ? (
        <div role="alert" className="mt-4 text-sm text-danger flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" aria-hidden /> {error}
        </div>
      ) : null}

      {committed ? (
        <Card className="mt-6 border-success/50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" aria-hidden />
            <div>
              <h2 className="text-xl font-semibold">Import complete</h2>
              <p className="text-sm text-fg-muted">
                Imported <strong>{committed.imported}</strong> entries from
                <span className="font-mono"> {committed.filename}</span> ·
                skipped {committed.skipped}. Batch ID: <span className="font-mono">{committed.batchId}</span>
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {preview ? (
        <Card className="mt-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Preview — {preview.totalParsed} entries parsed</h2>
              <p className="text-sm text-fg-muted">
                {preview.sheets.length} sheets scanned. Skipped {preview.skipped} rows
                (empty / unresolved date).
              </p>
            </div>
            <Button onClick={onCommit} disabled={loading || preview.totalParsed === 0}>
              {loading ? "Importing..." : `Confirm import (${preview.totalParsed})`}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {Object.entries(preview.template).map(([s, t]) => (
              <div key={s} className="text-xs bg-bg-muted rounded-md px-2 py-1 truncate">
                <span className="font-mono text-fg-muted">{s}</span>{" "}
                <span className={t === "UNKNOWN" ? "text-warning" : "text-success"}>{t}</span>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">Task</th>
                  <th className="px-3 py-2 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((e, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 tabular-nums">{e.date}</td>
                    <td className="px-3 py-2 tabular-nums text-fg-muted">
                      {e.startTime ? `${e.startTime}${e.endTime ? "–" + e.endTime : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 max-w-lg">
                      <p className="font-medium">{e.taskTitle}</p>
                      <p className="text-xs text-fg-subtle line-clamp-1">{e.description}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-fg-muted">
                      {e.sourceSheet}:{e.sourceRow}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.skippedSample.length > 0 ? (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-fg-muted">
                Show {preview.skippedSample.length} skipped-row samples
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {preview.skippedSample.map((s, i) => (
                  <li key={i} className="font-mono">
                    {s.sheet}:{s.row} — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
