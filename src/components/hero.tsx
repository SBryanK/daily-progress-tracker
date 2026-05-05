"use client";

import { useLanguage } from "@/components/language-provider";

/**
 * Hero — a minimal, gradient-filled title sitting just under the
 * header. Client component so it stays reactive to the language switch
 * without forcing a server round-trip.
 *
 * Spacing rationale: `pt-8 sm:pt-12` sits just below the public
 * header, and `pb-10 sm:pb-14` opens up the gap down to the journal
 * feed so the heading never feels clipped against the first entry
 * card. `leading-[1.1]` + bottom padding on the gradient container
 * also prevents descenders (g / y) from being trimmed by the
 * background-clip: text bounding box on some Safari versions.
 */
export function Hero() {
  const { t } = useLanguage();
  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-14 pt-8 sm:pt-12 pb-10 sm:pb-14">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] pb-1 text-gradient-accent">
        {t("hero.title")}
      </h1>
    </section>
  );
}
