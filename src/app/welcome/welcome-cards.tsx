"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Eye, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { markVisitor } from "./actions";

/**
 * Two-card chooser shown on /welcome. The Visitor card is a server-
 * action button (sets the cookie and bounces back to "/"). The Owner
 * card is a Link to /login because the cookie is only set after a
 * successful credentials check — we do NOT want a random visitor to
 * be able to mark themselves as Owner without authenticating.
 */
export function WelcomeCards({ next }: { next: string }) {
  const [pending, startTransition] = useTransition();

  function chooseVisitor() {
    startTransition(async () => {
      await markVisitor(next);
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
      {/* Owner card */}
      <Link
        href={`/login?next=${encodeURIComponent(next)}&fromWelcome=1`}
        className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-6 sm:p-7 hover:border-accent hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="I'm the Owner — sign in"
      >
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm"
        >
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
            I&rsquo;m the Owner (Bryan)
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">
            Sign in once and your browser remembers it for a full year.
            Unlocks the daily composer, edit history, import/export and
            share-link tools.
          </p>
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-accent group-hover:translate-x-0.5 transition-transform">
          Sign in
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>

      {/* Visitor card */}
      <button
        type="button"
        onClick={chooseVisitor}
        disabled={pending}
        className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-6 sm:p-7 text-left hover:border-accent hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-70 disabled:cursor-not-allowed"
        aria-label="I'm a Visitor — read only"
      >
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-muted text-fg shadow-sm"
        >
          <Eye className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
            I&rsquo;m a Visitor
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">
            Continue without signing in. You&rsquo;ll see Bryan&rsquo;s
            journal, calendar and AI summary — all read only. We&rsquo;ll
            remember your choice for a year so you don&rsquo;t see this
            screen again on this browser.
          </p>
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-fg group-hover:translate-x-0.5 transition-transform">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Continuing…
            </>
          ) : (
            <>
              Continue as visitor
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </span>
      </button>
    </div>
  );
}
