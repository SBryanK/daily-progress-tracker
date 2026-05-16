import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { ROLE_COOKIE } from "@/app/welcome/constants";

const { auth } = NextAuth(authConfig);

/**
 * Public-by-default middleware.
 *
 * Two layers run on every request:
 *
 *   1. Welcome gate (`dpt.role` cookie).
 *      First-time browsers (no cookie) are sent to /welcome to choose
 *      Owner vs Visitor. The choice is remembered for one year. Once
 *      remembered, the gate is skipped entirely.
 *
 *      Routes that bypass the gate by design:
 *        • /welcome itself
 *        • /login (Owner cards link there)
 *        • /api/* (machine traffic — health, auth callbacks, share JSON)
 *        • /share/<token> (read-only public view)
 *        • Static assets (handled by `matcher` already)
 *
 *   2. Auth gate (existing).
 *      Anyone can READ the public surfaces. Only WRITE/DELETE surfaces
 *      and admin-only API methods require an authenticated admin
 *      session. Anonymous visitors hitting a private route are bounced
 *      to /?signin=1&next=<path>.
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

// Welcome-gate allowlist: paths a browser can reach without having
// answered the gate yet. Anything else triggers the redirect.
const WELCOME_BYPASS_PREFIXES = [
  "/welcome",
  "/login",
  "/api/",
  "/share/", // public share tokens
  "/_next/",
  "/favicon",
  "/brand/",
];

function isPrivate(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (PRIVATE_PATTERNS.some((re) => re.test(pathname))) return true;
  if (PRIVATE_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (PRIVATE_API_EXACT.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return false;
}

function bypassesWelcomeGate(pathname: string): boolean {
  // Each entry is treated as either an exact path or a prefix; we do NOT
  // accept partial matches like `/loginredirect` for `"/login"` because
  // those would let attackers craft URLs that quietly skip the gate.
  for (const raw of WELCOME_BYPASS_PREFIXES) {
    const exact = raw.replace(/\/$/, "");
    if (pathname === exact) return true;
    // Treat the entry as a directory prefix only when it ends with `/`
    // OR when followed by a `/` segment in the request path.
    if (raw.endsWith("/") && pathname.startsWith(raw)) return true;
    if (pathname.startsWith(exact + "/")) return true;
  }
  return false;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // ── Layer 1: Welcome gate ────────────────────────────────────────────
  if (!bypassesWelcomeGate(pathname)) {
    const role = req.cookies.get(ROLE_COOKIE)?.value;
    const hasChosen = role === "owner" || role === "visitor";
    if (!hasChosen) {
      const url = req.nextUrl.clone();
      url.pathname = "/welcome";
      url.search = "";
      url.searchParams.set("next", pathname + (req.nextUrl.search || ""));
      return NextResponse.redirect(url);
    }
  }

  // ── Layer 2: Auth gate ───────────────────────────────────────────────
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
