"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

/**
 * Admin-only primary CTA that lives in the main content column
 * (not in the header chrome). Only rendered when the current session
 * is an ADMIN — the parent server component decides that.
 */
export function AdminCta() {
  const { t } = useLanguage();
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-6">
      <Link
        href="/progress/new"
        className="group inline-flex w-full sm:w-auto items-center justify-between gap-4 rounded-xl border border-dashed border-border-strong bg-bg-subtle/50 px-5 py-4 text-left hover:bg-bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm group-hover:bg-accent-hover transition-colors"
          >
            <PlusCircle className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">
              {t("admin.logToday.title")}
            </span>
            <span className="block text-[13px] text-fg-muted">
              {t("admin.logToday.hint")}
            </span>
          </span>
        </span>
        <span className="text-[13px] text-fg-muted group-hover:text-fg">
          {t("admin.logToday.cta")}
        </span>
      </Link>
    </section>
  );
}
