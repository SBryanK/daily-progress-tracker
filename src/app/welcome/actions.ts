"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLE_COOKIE, ROLE_COOKIE_MAX_AGE_SECONDS } from "./constants";

/**
 * Server actions that drive the Welcome gate cookie.
 *
 * The cookie is purely a UI-level "remembered choice" — it does NOT
 * grant authorisation. Authorisation continues to be enforced by
 * NextAuth + middleware, exactly as before.
 *
 *   dpt.role=visitor   → the chooser is suppressed; site renders read-
 *                       only as it did before this revamp.
 *   dpt.role=owner     → the chooser is suppressed AND the homepage
 *                       offers the owner composer / admin nav.
 */

async function setRoleCookie(role: "visitor" | "owner") {
  const jar = await cookies();
  jar.set(ROLE_COOKIE, role, {
    httpOnly: false, // readable by client-side code if it ever needs to
    sameSite: "lax",
    path: "/",
    maxAge: ROLE_COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Mark the current browser as a Visitor for the next year and redirect
 * back to the landing page (or whichever route was originally
 * requested).
 */
export async function markVisitor(next?: string) {
  await setRoleCookie("visitor");
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

/**
 * Mark the current browser as the Owner — *only* called from the
 * /login flow after a successful credentials check. Calling this on
 * its own does NOT grant admin powers; it is purely the "remember my
 * role" cookie.
 */
export async function markOwnerCookie() {
  await setRoleCookie("owner");
}

/**
 * Forget the role choice and redirect to /welcome. Used by the footer's
 * "Switch role" link. We also clear the role cookie cookie so the gate
 * re-appears on the next request.
 */
export async function switchRole() {
  const jar = await cookies();
  jar.delete(ROLE_COOKIE);
  redirect("/welcome");
}
