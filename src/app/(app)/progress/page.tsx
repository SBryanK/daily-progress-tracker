import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * `/progress` was the old "Progress history" table. Bryan removed it
 * in v2.2 in favour of the infinite-scroll journal on the landing
 * page — so this route now just forwards every request to `/`.
 *
 * The child routes under `/progress/...` (specifically `/progress/new`
 * and `/progress/[id]` for the edit form) are untouched — they remain
 * the admin entry-point for creating and editing individual records.
 */
export default function ProgressIndexRedirect() {
  redirect("/");
}
