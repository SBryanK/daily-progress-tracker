"use client";

import { useState } from "react";
import { Sparkles, Copy, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

type SummaryKind = "daily" | "weekly" | "monthly";
type Resp = {
  kind: SummaryKind;
  from: string;
  to: string;
  count: number;
  summary: string;
  provider: "anthropic" | "openai" | "deterministic";
};

/**
 * AI summary block embedded at the bottom of the landing page.
 *
 * Public-readable: the /api/summary endpoint is open (lightly
 * rate-limited) so visitors can regenerate the narrative without signing
 * in. When Claude returns, the summary renders as lightly-formatted
 * paragraphs (Markdown-ish: supports **bold** and bullet lines).
 */
export function AiSummaryPanel() {
  const { t } = useLanguage();
  const KINDS: { value: SummaryKind; labelKey: Parameters<typeof t>[0] }[] = [
    { value: "daily", labelKey: "ai.periodDaily" },
    { value: "weekly", labelKey: "ai.periodWeekly" },
    { value: "monthly", labelKey: "ai.periodMonthly" },
  ];
  const [kind, setKind] = useState<SummaryKind>("weekly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Resp | null>(null);
  const [copied, setCopied] = useState(false);

  async function onGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        from: from || undefined,
        to: to || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Request failed (${res.status})`);
      return;
    }
    setResult((await res.json()) as Resp);
  }

  async function onCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <section
      aria-labelledby="ai-summary-heading"
      className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-20"
    >
      <div className="rounded-2xl border border-border bg-bg-surface overflow-hidden">
        <header className="flex flex-wrap items-end justify-between gap-3 px-6 py-5 border-b border-border bg-bg-subtle/50">
          <div>
            <h2
              id="ai-summary-heading"
              className="mt-1 text-xl font-semibold tracking-tight"
            >
              {t("ai.title")}
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted max-w-xl">
              {t("ai.subtitle")}
            </p>
          </div>
        </header>

        <form
          onSubmit={onGenerate}
          className="px-6 py-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-b border-border"
        >
          <div className="sm:col-span-1 flex flex-col gap-1.5">
            <label htmlFor="ai-kind" className="text-sm font-medium">
              {t("ai.period")}
            </label>
            <select
              id="ai-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as SummaryKind)}
              className="h-10 px-3 rounded-md bg-bg border border-border text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {t(k.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ai-from" className="text-sm font-medium">
              {t("ai.from")}
            </label>
            <input
              id="ai-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 px-3 rounded-md bg-bg border border-border text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ai-to" className="text-sm font-medium">
              {t("ai.to")}
            </label>
            <input
              id="ai-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 px-3 rounded-md bg-bg border border-border text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <Button type="submit" disabled={loading} className="h-10">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("ai.writing")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                {t("ai.generate")}
              </>
            )}
          </Button>
        </form>

        <div className="min-h-[140px]">
          {error ? (
            <div
              role="alert"
              className="mx-6 my-5 rounded-md bg-danger/10 border border-danger/25 px-3 py-2 text-sm text-danger"
            >
              {error}
            </div>
          ) : result ? (
            <article>
              {/* Meta row stays pinned outside the scroll region so the
                  copy control remains reachable no matter how far the
                  narrative has been scrolled. Per Bryan's request we no
                  longer show the raw entry count or the AI provider
                  name — the narrative itself speaks for the result. */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-fg-subtle px-6 pt-5 pb-3">
                <span>{result.kind}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {result.from} → {result.to}
                </span>
                <span className="ml-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={onCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden /> {t("ai.copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden /> {t("ai.copy")}
                      </>
                    )}
                  </Button>
                </span>
              </div>

              {/* The actual narrative lives in its own scroll panel so a
                  long response (e.g. monthly summaries) does not balloon
                  the page height. `max-h` is chosen so ~12 lines of text
                  are visible before scrolling kicks in; `overscroll`
                  containment prevents wheel leakage to the page. */}
              <div
                role="region"
                aria-label="AI-written summary output"
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                className="thin-scrollbar overflow-y-auto max-h-[min(65vh,520px)] px-6 pb-6 [overscroll-behavior:contain] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                <RenderedMarkdown text={result.summary} />
              </div>
            </article>
          ) : (
            <div className="px-6 py-12 text-center text-fg-muted">
              <p className="text-sm">{t("ai.placeholder")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Very small Markdown-ish renderer for the summary body. Supports:
 *   • ## Heading
 *   • **bold**
 *   • - bullet lines
 *   • blank lines → paragraph break
 * No HTML is interpreted — every inline span is React text, so XSS is
 * structurally impossible.
 */
function RenderedMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(
        <ul
          key={`ul-${blocks.length}`}
          className="my-2 list-disc pl-5 space-y-1 text-[15px] leading-relaxed text-fg"
        >
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-•]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-•]\s+/, ""));
      continue;
    }
    flushBullets();
    if (!line.trim()) {
      blocks.push(<div key={`sp-${blocks.length}`} className="h-2" />);
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      const level = (line.match(/^#+/) ?? ["#"])[0]!.length;
      const text = line.replace(/^#+\s+/, "");
      const className =
        level === 1
          ? "text-lg font-semibold mt-3 mb-1"
          : level === 2
            ? "text-[15px] font-semibold mt-3 mb-1"
            : "text-[14px] font-semibold mt-2 mb-1 text-fg-muted";
      blocks.push(
        <p key={`h-${blocks.length}`} className={className}>
          {renderInline(text)}
        </p>,
      );
      continue;
    }
    blocks.push(
      <p
        key={`p-${blocks.length}`}
        className="text-[15px] leading-relaxed text-fg"
      >
        {renderInline(line)}
      </p>,
    );
  }
  flushBullets();
  return <div>{blocks}</div>;
}

function renderInline(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(
      <strong key={key++} className="font-semibold">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}
