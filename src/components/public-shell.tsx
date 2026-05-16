"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import {
  Moon,
  Sun,
  LogOut,
  Upload,
  Download,
  Share2,
  Languages,
} from "lucide-react";
import { SignInDialog } from "@/components/signin-dialog";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

type User = {
  name: string;
  email: string;
  role: "ADMIN" | "VIEWER";
} | null;

/**
 * PublicShell — shared chrome for every publicly-readable page.
 *
 * Top bar carries the Tencent Cloud logo (no title wordmark), the
 * Overview / Calendar tabs, and the utility controls on the right
 * (language toggle, theme toggle, sign-in / sign-out). The "Add entry"
 * primary action does NOT live in the header — it sits inside the main
 * dashboard so it feels like part of the journal rather than chrome.
 */
export function PublicShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: User;
}) {
  const pathname = usePathname();
  const { lang, setLang, t } = useLanguage();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  function toggleLang() {
    setLang(lang === "en" ? "zh" : "en");
  }

  const PUBLIC_NAV = [
    { href: "/", label: t("nav.overview") },
    { href: "/calendar", label: t("nav.calendar") },
  ];

  const ADMIN_NAV = [
    { href: "/import", label: t("nav.import"), icon: Upload },
    { href: "/export", label: t("nav.export"), icon: Download },
    { href: "/share", label: t("nav.share"), icon: Share2 },
  ];

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen flex flex-col pb-10">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-14 h-14 flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
            aria-label={t("nav.home")}
          >
            <Image
              src="/brand/t.svg"
              alt="Tencent Cloud"
              width={28}
              height={28}
            />
          </Link>

          <nav aria-label="Primary" className="flex items-center">
            {PUBLIC_NAV.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-3 text-sm transition-colors",
                    active
                      ? "text-fg font-medium"
                      : "text-fg-muted hover:text-fg",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {user ? (
              <nav
                aria-label="Admin"
                className="hidden lg:flex items-center gap-0.5 mr-1"
              >
                {ADMIN_NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={isActive(n.href) ? "page" : undefined}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors",
                      isActive(n.href)
                        ? "bg-bg-muted text-fg"
                        : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                    )}
                  >
                    <n.icon className="h-3.5 w-3.5" aria-hidden />
                    {n.label}
                  </Link>
                ))}
              </nav>
            ) : null}

            <button
              type="button"
              onClick={toggleLang}
              aria-label={
                lang === "en" ? t("lang.switchTo.zh") : t("lang.switchTo.en")
              }
              title={
                lang === "en" ? t("lang.switchTo.zh") : t("lang.switchTo.en")
              }
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Languages className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular-nums">
                {lang === "en" ? "EN" : "中"}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dark ? t("theme.toLight") : t("theme.toDark")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {dark ? (
                <Sun className="h-4 w-4" aria-hidden />
              ) : (
                <Moon className="h-4 w-4" aria-hidden />
              )}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-fg-muted hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`${t("nav.signOut")} ${user.email}`}
                title={user.email}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{t("nav.signOut")}</span>
              </button>
            ) : (
              <Suspense fallback={null}>
                <SignInDialog triggerLabel={t("nav.signIn")} />
              </Suspense>
            )}
          </div>
        </div>

        {/*
          Mobile / tablet secondary nav.

          Renders BOTH the public tabs (Overview, Calendar) AND, when
          the visitor is signed in, the admin shortcuts (Import, Export,
          Share). The previous version only showed admin items here,
          which left small-screen visitors with no way to jump to the
          Calendar once the top tab row scrolled off the viewport.
          (Fixes A3 + A10.)
        */}
        <nav
          aria-label="Primary (mobile)"
          className="lg:hidden border-t border-border/70 bg-bg/85"
        >
          <ul className="flex items-center gap-1 px-3 py-1.5 text-sm overflow-x-auto">
            {PUBLIC_NAV.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  aria-current={isActive(p.href) ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 whitespace-nowrap text-[13px]",
                    isActive(p.href)
                      ? "bg-bg-muted text-fg font-medium"
                      : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                  )}
                >
                  {p.label}
                </Link>
              </li>
            ))}
            {user
              ? ADMIN_NAV.map((a) => (
                  <li key={a.href}>
                    <Link
                      href={a.href}
                      aria-current={isActive(a.href) ? "page" : undefined}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md px-3 whitespace-nowrap text-[13px]",
                        isActive(a.href)
                          ? "bg-bg-muted text-fg font-medium"
                          : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                      )}
                    >
                      <a.icon className="h-3.5 w-3.5" aria-hidden />
                      {a.label}
                    </Link>
                  </li>
                ))
              : null}
          </ul>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      {/*
        Slim, always-visible footer — fixed to the viewport bottom so it
        remains in view on every layout, every page, at every scroll
        position. The parent `<div>` reserves `pb-10` (40 px) so page
        content never slides underneath it. Height is intentionally
        small (40 px) and uses a full-opacity blurred surface so it
        reads as chrome, not decoration.
      */}
      <footer className="fixed bottom-0 inset-x-0 z-30 h-10 border-t border-border/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1600px] h-full px-4 sm:px-6 lg:px-10 xl:px-14 flex items-center justify-between gap-4 text-[11px] sm:text-xs">
          <p className="text-fg-muted truncate">
            <span className="font-medium text-fg">{t("footer.owner")}</span>
            <span className="mx-1.5 text-fg-subtle" aria-hidden>·</span>
            <span className="hidden sm:inline">{t("footer.role")}</span>
            <span className="hidden sm:inline mx-1.5 text-fg-subtle" aria-hidden>·</span>
            <span className="text-fg-subtle">{t("footer.location")}</span>
          </p>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <Link
              href="/api/welcome/switch-role"
              prefetch={false}
              className="text-fg-subtle hover:text-fg underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              title="Forget my role choice and show the welcome screen again"
            >
              {t("footer.switchRole")}
            </Link>
            <span className="text-fg-subtle" aria-hidden>·</span>
            <p className="text-fg-subtle tabular-nums">
              © {new Date().getFullYear()} · {t("footer.rights")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
