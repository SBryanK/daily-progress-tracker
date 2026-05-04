"use client";

import { useLanguage } from "@/components/language-provider";

/** Localised empty-state panel for the landing page. */
export function JournalEmpty() {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-border bg-bg-surface p-10 text-center text-sm text-fg-muted">
      {t("journal.empty")}
    </div>
  );
}
