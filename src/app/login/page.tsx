import { redirect } from "next/navigation";

/**
 * /login used to be a full page. The site is now public-by-default and the
 * sign-in control lives in a modal dialog on the landing page. We keep this
 * route as a redirect for backward-compat (old bookmarks, NextAuth
 * `pages.signIn`, etc.) so nothing 404s.
 */
export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.callbackUrl ?? "/dashboard";
  redirect(`/?signin=1&next=${encodeURIComponent(next)}`);
}
