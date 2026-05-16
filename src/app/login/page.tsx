import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

/**
 * Dedicated /login page.
 *
 * This route used to redirect to the landing page's sign-in modal. It is
 * now a proper full-page login experience so deep links, bookmarks, and
 * NextAuth's `pages.signIn` target all render a polished, focused UI.
 *
 * If the visitor is already authenticated we send them straight to the
 * destination they asked for (or the dashboard by default) — no point
 * showing them a login form.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.callbackUrl ?? sp.next ?? "/dashboard";

  const session = await auth();
  if (session?.user) {
    redirect(next);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-bg">
      {/* Decorative background — subtle, brand-tinted, respects dark mode */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(0,82,217,0.18),transparent_60%)] dark:bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(56,134,255,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_90%_110%,rgba(0,82,217,0.10),transparent_60%)] dark:bg-[radial-gradient(800px_400px_at_90%_110%,rgba(56,134,255,0.12),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* LEFT — brand / story (hidden on small screens) */}
        <section className="hidden lg:flex flex-col justify-between min-h-[640px]">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 w-max text-sm text-fg-muted hover:text-fg transition-colors"
          >
            <Image
              src="/brand/t.svg"
              alt=""
              width={20}
              height={26}
              className="h-6 w-auto"
              priority
            />
            <span className="font-semibold tracking-tight text-fg">
              Bryan&rsquo;s Daily Progress
            </span>
          </Link>

          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-fg">
              Welcome back.
            </h1>
          </div>

          <p className="text-xs text-fg-subtle">
            © {new Date().getFullYear()} · Bryan Santasila Kusno
          </p>
        </section>

        {/* RIGHT — login card */}
        <section className="flex items-center justify-center">
          <div className="w-full max-w-[440px]">
            {/* Mobile brand header — only visible on small screens */}
            <Link
              href="/"
              className="mb-6 flex items-center gap-2 lg:hidden"
            >
              <Image
                src="/brand/t.svg"
                alt=""
                width={20}
                height={26}
                className="h-6 w-auto"
                priority
              />
              <span className="font-semibold tracking-tight text-fg">
                Bryan&rsquo;s Daily Progress
              </span>
            </Link>

            <div className="rounded-2xl border border-border bg-bg-surface shadow-xl shadow-fg/5 backdrop-blur-sm">
              <div className="p-7 sm:p-8">
                <header className="mb-6">
                  <h2 className="text-2xl font-semibold tracking-tight text-fg">
                    Sign in
                  </h2>
                  <p className="mt-1.5 text-[13.5px] text-fg-muted">
                    Use your admin credentials to continue.
                  </p>
                </header>

                <LoginForm
                  next={next}
                  initialError={sp.error ? decodeURIComponent(sp.error) : null}
                />

                <div className="mt-6 border-t border-border pt-5">
                  <p className="text-[12.5px] text-fg-subtle text-center">
                    Just browsing? The journal is public —{" "}
                    <Link
                      href="/"
                      className="text-accent hover:underline underline-offset-2 font-medium"
                    >
                      go back to the site
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
