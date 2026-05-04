import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";

/**
 * Smart layout for the `(app)` route group.
 *
 * The site is now public-by-default. This layout picks one of two chromes:
 *
 *  • PRIVATE routes (/progress/new, /progress/:id, /import, /export, /share)
 *    → require an ADMIN session (middleware enforces this up-front, this is
 *      a belt-and-braces fallback)
 *    → render the full AppShell with sidebar nav
 *
 *  • PUBLIC routes (/dashboard, /progress, /calendar, /summary)
 *    → render the lightweight PublicShell (with inline sign-in dialog for
 *      anon visitors, and quick-access admin controls when a session exists)
 */
const PRIVATE_SEGMENTS = ["/progress/new", "/import", "/export", "/share"];
const PRIVATE_PATTERNS: RegExp[] = [/^\/progress\/[^/]+(\/|$)/];

function isPrivate(p: string): boolean {
  if (PRIVATE_SEGMENTS.some((s) => p === s || p.startsWith(s + "/"))) return true;
  return PRIVATE_PATTERNS.some((re) => re.test(p));
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const hdrs = await headers();
  const rawPath =
    hdrs.get("x-invoke-path") ??
    hdrs.get("next-url") ??
    hdrs.get("x-matched-path") ??
    hdrs.get("x-pathname") ??
    "";
  const pathname = (rawPath.split("?")[0] ?? "").trim();
  const priv = isPrivate(pathname);

  if (priv) {
    if (!session?.user) {
      redirect(`/?signin=1&next=${encodeURIComponent(pathname || "/dashboard")}`);
    }
    return (
      <AppShell
        userName={session!.user.name ?? session!.user.email ?? "User"}
      >
        {children}
      </AppShell>
    );
  }

  const user = session?.user
    ? {
        name: session.user.name ?? session.user.email ?? "User",
        email: session.user.email ?? "",
        role:
          ((session.user as unknown as { role?: string }).role as
            | "ADMIN"
            | "VIEWER"
            | undefined) ?? "VIEWER",
      }
    : null;

  return <PublicShell user={user}>{children}</PublicShell>;
}
