/**
 * AI summary module.
 *
 * Order of precedence:
 *   1. OPENAI_API_KEY  → OpenAI chat completions
 *   2. ANTHROPIC_API_KEY → Anthropic Messages API
 *   3. deterministic fallback → always works, no network
 *
 * The deterministic fallback keeps the feature functional when no
 * key is configured (which is the default). This matches the PRD §10
 * expectation that the summary feature "can" generate reports.
 */

import type { ProgressEntry } from "@prisma/client";
import { statusLabel } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import { logger } from "@/lib/logger";

export type SummaryKind = "daily" | "weekly" | "monthly" | "manager";

export type SummaryInput = {
  kind: SummaryKind;
  fromDate: string;
  toDate: string;
  entries: ProgressEntry[];
};

export async function generateSummary(input: SummaryInput): Promise<string> {
  const provider =
    (process.env.OPENAI_API_KEY && "openai") ||
    (process.env.ANTHROPIC_API_KEY && "anthropic") ||
    "fallback";

  const prompt = buildPrompt(input);

  try {
    if (provider === "openai") return await openai(prompt);
    if (provider === "anthropic") return await anthropic(prompt);
  } catch (err) {
    logger.warn("ai.summary.provider_failed", {
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return deterministic(input);
}

function buildPrompt(input: SummaryInput): string {
  const header = `You are an assistant helping a solutions engineer write a concise, professional ${input.kind} progress report for the period ${input.fromDate} to ${input.toDate}. Use crisp business English, short sections with bullet points, and no emojis. Output sections: "Summary", "Key accomplishments", "Blockers", "Next steps".`;
  const body = input.entries
    .slice(0, 200)
    .map((e) => {
      const parts = [
        `- ${e.date.toISOString().slice(0, 10)}`,
        e.projectName ? `[${e.projectName}]` : "",
        `${e.taskTitle}`,
        `— status: ${statusLabel(e.status)}`,
        e.blockers ? `(blocker: ${e.blockers.slice(0, 240)})` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return parts;
    })
    .join("\n");
  return `${header}\n\nENTRIES:\n${body}`;
}

async function openai(prompt: string): Promise<string> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You write concise manager-friendly progress reports. Please give output in human readable format" },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function anthropic(prompt: string): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-4-5-haiku-latest";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  return json.content?.map((c) => c.text ?? "").join("\n").trim() ?? "";
}

function deterministic(input: SummaryInput): string {
  const { entries } = input;
  if (entries.length === 0) {
    return `## ${titleCase(input.kind)} summary (${input.fromDate} → ${input.toDate})\n\nNo entries recorded for this period.`;
  }

  const totalMin = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  const byStatus: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const blockers: string[] = [];
  const next: string[] = [];
  const accomplishments: string[] = [];

  for (const e of entries) {
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    const proj = e.projectName?.trim() || "Unassigned";
    byProject[proj] = (byProject[proj] ?? 0) + 1;
    if (e.blockers) blockers.push(`- ${e.blockers.split("\n")[0]!.slice(0, 200)}`);
    if (e.nextAction) next.push(`- ${e.nextAction.split("\n")[0]!.slice(0, 200)}`);
    if (e.status === "COMPLETED") accomplishments.push(`- ${e.taskTitle.slice(0, 200)}`);
  }

  const top = (o: Record<string, number>, n = 5) =>
    Object.entries(o)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `- ${k} (${v})`)
      .join("\n") || "- (none)";

  return `## ${titleCase(input.kind)} summary (${input.fromDate} → ${input.toDate})

**At a glance**
- Entries: ${entries.length}
- Time logged: ${formatDuration(totalMin)}
- Unique projects: ${Object.keys(byProject).length}

**By project**
${top(byProject)}

**By status**
${Object.entries(byStatus)
  .map(([k, v]) => `- ${statusLabel(k)}: ${v}`)
  .join("\n")}

**Key accomplishments**
${accomplishments.slice(0, 8).join("\n") || "- (none completed in this period)"}

**Blockers**
${blockers.slice(0, 8).join("\n") || "- (none flagged)"}

**Next steps**
${next.slice(0, 8).join("\n") || "- (none flagged)"}
`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
