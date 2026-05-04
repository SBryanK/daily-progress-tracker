"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { STATUS } from "@/lib/constants";
import { Download, FileDown } from "lucide-react";

export default function ExportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState("");

  function buildUrl(format: "xlsx" | "csv") {
    const params = new URLSearchParams({ format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (project) params.set("project", project);
    if (status) params.set("status", status);
    return `/api/export?${params.toString()}`;
  }

  async function downloadPdf() {
    const params = new URLSearchParams({ format: "json" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (project) params.set("project", project);
    if (status) params.set("status", status);
    const res = await fetch(`/api/export?${params.toString()}`);
    const data = (await res.json()) as { rows: Record<string, string>[] };

    const [{ jsPDF }, autoTableMod] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text("Daily Progress Report", 40, 40);
    doc.setFontSize(10);
    doc.text(
      `Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      40,
      58,
    );

    const columns = ["Date", "Start", "End", "Project", "Task", "Status", "Description"];
    const body = data.rows.map((r) =>
      columns.map((c) => (r[c] ?? "").toString().slice(0, 240)),
    );
    const autoTable = (autoTableMod as unknown as { default: (doc: unknown, opts: unknown) => void })
      .default;
    autoTable(doc, {
      head: [columns],
      body,
      startY: 76,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    });
    doc.save(`progress-${Date.now()}.pdf`);
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Export report</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Download your progress in Excel, CSV, or PDF. Filter by date range, project, or status.
        </p>
      </header>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input
            label="Project contains"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="e.g. BNI"
          />
          <Select
            label="Status"
            options={STATUS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={buildUrl("xlsx")}
            className="inline-flex items-center h-10 px-4 rounded-lg bg-accent text-accent-fg font-medium hover:bg-accent-hover gap-2"
          >
            <FileDown className="h-4 w-4" aria-hidden /> Download Excel
          </a>
          <a
            href={buildUrl("csv")}
            className="inline-flex items-center h-10 px-4 rounded-lg border border-border hover:bg-bg-muted gap-2"
          >
            <Download className="h-4 w-4" aria-hidden /> Download CSV
          </a>
          <Button variant="secondary" onClick={downloadPdf} type="button">
            <FileDown className="h-4 w-4" aria-hidden /> Download PDF
          </Button>
        </div>
      </Card>
    </div>
  );
}
