/**
 * Time helpers — single source of truth for wall-clock semantics.
 *
 * The site is run by Bryan from Jakarta (UTC+7). Most of the codebase
 * historically used `new Date().toISOString().slice(0, 10)` for "today",
 * which is *UTC* — meaning the calendar's "today" highlight, the
 * landing-page "live" pulse, and the composer's default date all flip
 * one day early during the 00:00 → 07:00 local window.
 *
 * Centralising the calculation here means we can swap the timezone in
 * a single place if Bryan ever moves cities.
 */

/** The wall-clock timezone the owner currently lives in. */
export const OWNER_TIMEZONE = "Asia/Jakarta";

/**
 * Return the calendar date (`YYYY-MM-DD`) of "now" in the owner's
 * timezone. Uses Intl.DateTimeFormat with the `en-CA` locale because
 * its default short format is already `YYYY-MM-DD` — no manual padding
 * required, and it works identically on Node, Edge, and the browser.
 */
export function todayInJakartaISO(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: OWNER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

/**
 * Return the calendar date (`YYYY-MM-DD`) for an arbitrary instant in
 * the owner's timezone. Useful for tagging entries created via the API
 * with the correct local day even if the request hits the server at
 * 23:30 UTC.
 */
export function isoDateInJakarta(d: Date): string {
  return todayInJakartaISO(d);
}

/**
 * `true` when the given ISO date is in the owner's local "future"
 * (strictly greater than today). Used by the calendar to NOT paint
 * future weekdays as Public Holiday hints.
 */
export function isFutureLocalDate(iso: string): boolean {
  return iso > todayInJakartaISO();
}
