import { NextResponse } from "next/server";
import { ROLE_COOKIE } from "@/app/welcome/constants";

/**
 * GET /api/welcome/switch-role
 *
 * Clears the `dpt.role` cookie and redirects the browser to the
 * Welcome chooser. Implemented as a route handler (not a server
 * action) so it can be linked from the client-side public-shell
 * footer with a plain `<a href>` — no client JS, no form ceremony,
 * works exactly the same regardless of where the link is rendered.
 *
 * NOTE: this only clears the role-choice cookie. The NextAuth session
 * cookie (if present) is *not* cleared here; sign-out has its own
 * dedicated flow. A signed-in Owner who clicks "Switch role" will
 * land on /welcome → choose Visitor → still be signed in but the UI
 * will treat them as a visitor on the public surfaces.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/welcome";
  const safe =
    next.startsWith("/") && !next.startsWith("//") ? next : "/welcome";

  const res = NextResponse.redirect(new URL(safe, url));
  // Setting Max-Age=0 (and matching Path/SameSite) reliably evicts the
  // cookie on every modern browser.
  res.cookies.set(ROLE_COOKIE, "", {
    path: "/",
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}
