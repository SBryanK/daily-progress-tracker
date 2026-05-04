import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Public-by-default middleware.
 *
 * Anyone can READ the landing page, dashboard, progress history, calendar,
 * AI summary page, public share tokens. Only the surfaces that let a user
 * WRITE / DELETE data require an authenticated admin session:
 *
 *   • /progress/new          — create entry form
 *   • /progress/:id          — view + edit entry (contains delete button)
 *   • /import                — Excel importer
 *   • /export                — download the tracker
 *   • /share                 — manage share-link dashboard (not /share/:token)
 *   • /api/progress          — POST + PATCH + DELETE
 *   • /api/import            — POST
 *   • /api/export            — GET (leaks raw rows)
 *   • /api/share             — POST + DELETE
 *   • /api/summary           — POST (costs tokens)
 *
 * Anonymous visitors hitting a private route are bounced to
 *   /?signin=1&next=<path>
 * so the embedded sign-in dialog pops open and the user is redirected after
 * authenticating.
 */
const PRIVATE_PREFIXES = [
  "/progress/new",
  "/import",
  "/export",
  "/share",
];
// Private sub-patterns (e.g. the edit page /progress/<id>).
const PRIVATE_PATTERNS: RegExp[] = [/^\/progress\/[^/]+(\/|$)/];

const PRIVATE_API_PREFIXES = [
  "/api/import",
  "/api/export",
];
// /api/share and /api/progress have mixed methods — require auth for all,
// public-readers don't need them because pages render server-side.
const PRIVATE_API_EXACT = ["/api/share", "/api/progress"];

// PUBLIC overrides that live under private prefixes — listed first, wins.
const PUBLIC_PREFIXES = ["/share/"]; // /share/<token> is public by design.

function isPrivate(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (PRIVATE_PATTERNS.some((re) => re.test(pathname))) return true;
  if (PRIVATE_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (PRIVATE_API_EXACT.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return false;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!isPrivate(pathname)) return NextResponse.next();

  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("signin", "1");
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}) as unknown as (req: NextRequest) => Response;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
