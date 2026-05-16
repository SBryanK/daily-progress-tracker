"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { X, Loader2, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import { markOwnerCookie } from "@/app/welcome/actions";

/**
 * Refined sign-in dialog.
 *
 * Opens when: (a) the "Sign in" trigger is clicked, or (b) the URL has
 * ?signin=1 (middleware redirect). Focus moves to the email input on
 * open, Escape closes, backdrop click closes, and the form is fully
 * keyboard-navigable.
 */
export function SignInDialog({
  triggerClassName,
  triggerLabel,
}: {
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const autoOpen = params.get("signin") === "1";
  const next = params.get("next") ?? "/";
  const { t } = useLanguage();

  const [open, setOpen] = useState(autoOpen);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (!open) return;
    emailRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    if (params.get("signin") || params.get("next")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("signin");
      url.searchParams.delete("next");
      router.replace(url.pathname + (url.search ? url.search : ""));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // See login-form.tsx for the rationale: NextAuth v5 beta's
    // signIn(redirect:false) does NOT reliably return { error } on bad
    // credentials. We must verify the resulting session ourselves.
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    if (res?.error) {
      setLoading(false);
      setError(t("signin.error"));
      return;
    }
    const session = await getSession();
    setLoading(false);
    if (!session?.user) {
      setError(t("signin.error"));
      setPassword("");
      return;
    }
    try {
      await markOwnerCookie();
    } catch {
      /* non-fatal — cookie is just a UX hint */
    }
    router.push(next || "/");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          triggerClassName,
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Lock className="h-3.5 w-3.5" aria-hidden />
        {triggerLabel ?? t("nav.signIn")}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-title"
        >
          <button
            type="button"
            aria-label="Close sign-in dialog"
            onClick={close}
            className="absolute inset-0 bg-fg/40 backdrop-blur-sm"
          />
        <div className="relative w-full max-w-[420px] rounded-2xl border border-border bg-bg-surface shadow-xl">
            <div className="p-7">
              <button
                type="button"
                onClick={close}
                aria-label={t("signin.close")}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>

              <div className="mb-5">
                <h2
                  id="signin-title"
                  className="text-xl font-semibold tracking-tight"
                >
                  {t("signin.title")}
                </h2>
                <p className="mt-1 text-[13px] text-fg-muted">
                  {t("signin.subtitle")}
                </p>
              </div>

              <form
                onSubmit={onSubmit}
                className="flex flex-col gap-3.5"
                aria-busy={loading}
              >
                <Input
                  ref={emailRef}
                  label={t("signin.email")}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <Input
                  label={t("signin.password")}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                {error ? (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="flex items-start gap-2 rounded-md bg-danger/10 border border-danger/30 px-3 py-2.5 text-[13px] text-danger animate-[shake_0.35s_ease-in-out]"
                  >
                    <AlertCircle
                      className="h-4 w-4 mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <span>{error}</span>
                  </div>
                ) : null}
                <Button
                  type="submit"
                  size="md"
                  disabled={loading}
                  className="mt-1 w-full"
                >
                  {loading ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden
                      />
                      {t("signin.submitting")}
                    </>
                  ) : (
                    t("signin.submit")
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
