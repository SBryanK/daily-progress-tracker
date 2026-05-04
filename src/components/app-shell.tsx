"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  PlusCircle,
  Calendar,
  Upload,
  Download,
  Share2,
  Sparkles,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress/new", label: "Add entry", icon: PlusCircle },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/import", label: "Import Excel", icon: Upload },
  { href: "/export", label: "Export", icon: Download },
  { href: "/share", label: "Share links", icon: Share2 },
  { href: "/summary", label: "AI summary", icon: Sparkles },
];

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const initial = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between border-b border-border px-4 h-14 sticky top-0 bg-bg z-20">
        <Link href="/dashboard" className="font-semibold">
          Progress
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg hover:bg-bg-muted"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="p-2 rounded-lg hover:bg-bg-muted"
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "md:w-64 md:shrink-0 md:border-r md:border-border md:flex md:flex-col md:h-screen md:sticky md:top-0",
          open ? "block" : "hidden md:block",
          "border-b border-border md:border-b-0",
        )}
        aria-label="Primary navigation"
      >
        <div className="hidden md:flex items-center justify-between px-5 h-14 border-b border-border">
          <Link href="/dashboard" className="font-semibold">
            Progress Tracker
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg hover:bg-bg-muted"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <nav className="p-3 flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 h-10 rounded-lg text-sm",
                  active ? "bg-accent/10 text-accent font-medium" : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-3 border-t border-border hidden md:block">
          <p className="px-3 text-xs text-fg-subtle">Signed in as</p>
          <p className="px-3 text-sm font-medium truncate">{userName}</p>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="mt-2 w-full flex items-center gap-2 px-3 h-10 rounded-lg text-sm text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-10">{children}</main>

      {/*
        Slim, always-visible footer (mirrors PublicShell). Fixed to the
        viewport bottom so the owner sees consistent chrome on every
        admin page (Add entry / Import / Export / Share / Summary).
      */}
      <footer className="fixed bottom-0 inset-x-0 z-30 h-10 border-t border-border/70 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 text-[11px] sm:text-xs">
          <p className="text-fg-muted truncate">
            <span className="font-medium text-fg">Bryan 郭檍祥</span>
            <span className="mx-1.5 text-fg-subtle" aria-hidden>·</span>
            <span className="hidden sm:inline text-fg-subtle">Solutions Architect Intern · Tencent Cloud</span>
          </p>
          <p className="text-fg-subtle whitespace-nowrap tabular-nums">
            © {new Date().getFullYear()} · All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
