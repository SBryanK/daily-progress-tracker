import { auth } from "@/lib/auth";

/**
 * Centralised "is the caller an authenticated ADMIN?" check.
 *
 * Every mutating API route (and any route that returns sensitive
 * editable payloads) should call this instead of the looser
 * `if (!session?.user)` pattern. Returns either:
 *
 *   • { ok: true,  userId, session }   — caller is an admin; proceed.
 *   • { ok: false, status, body }      — caller fails the check;
 *                                         feed `body` directly to
 *                                         `NextResponse.json(body, { status })`.
 *
 * Defence-in-depth even though the project currently has no public
 * sign-up: if a future provider ever lands a non-admin user in the
 * users table, mutating routes still refuse to honour their writes.
 */
export type AdminCheckResult =
  | {
      ok: true;
      userId: string;
      role: "ADMIN";
    }
  | {
      ok: false;
      status: 401 | 403;
      body: { error: string };
    };

export async function requireAdmin(): Promise<AdminCheckResult> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; role?: string }
    | undefined;
  if (!user?.id) {
    return {
      ok: false,
      status: 401,
      body: { error: "Unauthorized" },
    };
  }
  if (user.role !== "ADMIN") {
    return {
      ok: false,
      status: 403,
      body: { error: "Forbidden — admin role required." },
    };
  }
  return { ok: true, userId: user.id, role: "ADMIN" };
}
