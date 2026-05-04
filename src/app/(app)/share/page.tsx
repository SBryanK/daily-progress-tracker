"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { STATUS } from "@/lib/constants";
import { Copy, Trash2, Link2 } from "lucide-react";

type ShareLink = {
  id: string;
  label: string;
  token: string;
  fromDate: string | null;
  toDate: string | null;
  projectName: string | null;
  statusFilter: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
};

export default function SharePage() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    label: "",
    fromDate: "",
    toDate: "",
    projectName: "",
    statusFilter: "",
    expiresInDays: "30",
  });
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/share");
    if (res.ok) {
      const { links: ls } = (await res.json()) as { links: ShareLink[] };
      setLinks(ls);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = {
      ...form,
      expiresInDays: form.expiresInDays ? Number(form.expiresInDays) : undefined,
    };
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Failed to create link");
      return;
    }
    setForm({ label: "", fromDate: "", toDate: "", projectName: "", statusFilter: "", expiresInDays: "30" });
    await refresh();
  }

  async function onRevoke(id: string) {
    if (!confirm("Revoke this share link? Viewers will no longer be able to access it.")) return;
    const res = await fetch(`/api/share/${id}`, { method: "DELETE" });
    if (res.ok) await refresh();
  }

  function shareUrl(token: string) {
    const origin =
      (typeof window !== "undefined" && window.location.origin) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";
    return `${origin}/share/${token}`;
  }

  async function copy(id: string, token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Share links</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Generate unguessable read-only URLs for your manager or colleagues. Each link can be scoped by
          date range, project, and status, and revoked any time.
        </p>
      </header>

      <Card className="mb-6">
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <Input
              label="Label"
              required
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Weekly report for Mr. Sam"
            />
          </div>
          <Input
            label="From"
            type="date"
            value={form.fromDate}
            onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
          />
          <Input
            label="To"
            type="date"
            value={form.toDate}
            onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
          />
          <Input
            label="Project contains"
            value={form.projectName}
            onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
          />
          <Select
            label="Status"
            options={STATUS}
            value={form.statusFilter}
            onChange={(e) => setForm((f) => ({ ...f, statusFilter: e.target.value }))}
            placeholder="Any status"
          />
          <Input
            label="Expires in (days)"
            type="number"
            min={1}
            max={365}
            value={form.expiresInDays}
            onChange={(e) => setForm((f) => ({ ...f, expiresInDays: e.target.value }))}
          />
          {error ? (
            <div role="alert" className="md:col-span-6 text-sm text-danger">
              {error}
            </div>
          ) : null}
          <div className="md:col-span-6 flex justify-end">
            <Button type="submit" disabled={loading || !form.label}>
              <Link2 className="h-4 w-4" aria-hidden /> Create share link
            </Button>
          </div>
        </form>
      </Card>

      {links.length === 0 ? (
        <Card>
          <p className="text-sm text-fg-muted text-center py-6">No share links yet.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-border">
            {links.map((l) => (
              <li key={l.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {l.label}
                    {l.revoked ? <span className="ml-2 text-xs text-danger">(revoked)</span> : null}
                  </p>
                  <p className="text-xs text-fg-muted font-mono truncate">{shareUrl(l.token)}</p>
                  <p className="text-xs text-fg-subtle mt-1">
                    {l.fromDate ? `from ${l.fromDate.slice(0, 10)}` : "any date"}
                    {l.toDate ? ` to ${l.toDate.slice(0, 10)}` : ""}
                    {l.projectName ? ` · ${l.projectName}` : ""}
                    {l.expiresAt ? ` · expires ${l.expiresAt.slice(0, 10)}` : " · no expiry"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void copy(l.id, l.token)}
                    disabled={l.revoked}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden /> {copiedId === l.id ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void onRevoke(l.id)}
                    disabled={l.revoked}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
