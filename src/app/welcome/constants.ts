/**
 * Constants shared by the welcome / role-gate machinery.
 *
 * Lives in its own module (NOT inside `actions.ts`) because Next 15's
 * "use server" rule forbids exporting anything other than async
 * functions from a server-action file. Routes that need to know the
 * cookie name (the API switch-role handler, the middleware) import
 * from here.
 */

export const ROLE_COOKIE = "dpt.role";
export const ROLE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
