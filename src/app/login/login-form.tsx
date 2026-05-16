"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { markOwnerCookie } from "@/app/welcome/actions";

/**
 * LoginForm — the interactive half of /login.
 *
 * Lives in its own client file so the parent `page.tsx` can stay on the
 * server runtime and do the "already signed in → redirect" check before
 * React ever ships to the browser.
 *
 * Features:
 *   • Autofocuses the username field on mount.
 *   • Show/hide password toggle.
 *   • Client-side validation (required) before round-trip.
 *   • Proper `aria-live` error region with shake animation.
 *   • Disables the button + inputs while the credentials call is in
 *     flight, so double-submits are impossible.
 *   • Works with the existing NextAuth Credentials provider — no API
 *     change needed.
 */
export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError: string | null;
}) {
  const router = useRouter();
  const usernameRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    // Autofocus on mount — small timeout so browsers that autofill
    // credentials on page-load don't fight us for the cursor.
    const id = window.setTimeout(() => usernameRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername || !password) {
      setError("Username and password are both required.");
      return;
    }
    // Light client-side check — authoritative validation lives on the
    // server / in zod inside NextAuth's authorize().
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUsername)) {
      setError("Usernames may only contain letters, digits, dot, dash or underscore.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      // NOTE on NextAuth v5 (5.0.0-beta.25):
      // signIn("credentials", { redirect: false }) does NOT return a
      // reliable `{ error }` field — on bad credentials it can resolve
      // to `{ ok: true, error: undefined }` while the underlying
      // request 302's to the error URL. Trusting `res.error` lets ANY
      // password "succeed" client-side.  We therefore *always*
      // re-fetch the session and only treat the attempt as successful
      // when the server hands us a real authenticated user back.
      const res = await signIn("credentials", {
        username: trimmedUsername,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Incorrect username or password. Please try again.");
        setPassword("");
        return;
      }
      const session = await getSession();
      if (!session?.user) {
        // Bad creds — server rejected, but signIn() didn't surface it.
        setError("Incorrect username or password. Please try again.");
        setPassword("");
        return;
      }
      // Success — mark this browser as the Owner so the Welcome gate
      // is suppressed for the next year, then push to the callback URL
      // and force a server refresh so admin-only chrome (e.g. "Add
      // entry" CTA) renders on the next navigation. Cookie failure is
      // non-fatal: the user is still signed in and can re-pick their
      // role from the footer.
      try {
        await markOwnerCookie();
      } catch {
        /* swallow — the auth session itself is what gates writes */
      }
      router.push(next || "/dashboard");
      router.refresh();
    } catch (err) {
      // Network / unexpected error — don't leak details.
      setError("Something went wrong. Please try again in a moment.");
      // eslint-disable-next-line no-console
      console.error("[login]", err);
    } finally {
      setLoading(false);
    }
  }

  function onPasswordKey(e: React.KeyboardEvent<HTMLInputElement>) {
    // Best-effort caps-lock indicator; `getModifierState` is well-
    // supported in modern browsers and silently returns false otherwise.
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
      aria-busy={loading}
      noValidate
    >
      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-username"
          className="text-sm font-medium text-fg"
        >
          Username
        </label>
        <div className="relative">
          <User
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle"
          />
          <input
            ref={usernameRef}
            id="login-username"
            type="text"
            inputMode="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            disabled={loading}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-username"
            className="w-full h-11 pl-10 pr-3 rounded-lg bg-bg border border-border text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent disabled:opacity-60"
          />
        </div>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-password"
          className="text-sm font-medium text-fg"
        >
          Password
        </label>
        <div className="relative">
          <Lock
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle"
          />
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={onPasswordKey}
            onKeyDown={onPasswordKey}
            placeholder="••••••••"
            className="w-full h-11 pl-10 pr-11 rounded-lg bg-bg border border-border text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {capsLockOn ? (
          <p className="text-[11.5px] text-warning flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" aria-hidden />
            Caps Lock is on.
          </p>
        ) : null}
      </div>

      {/* Error banner */}
      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] text-danger animate-[shake_0.35s_ease-in-out]"
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
        className="mt-1 w-full h-11 text-[14px] font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}
