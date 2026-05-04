import { redirect } from "next/navigation";

// The landing page now IS the dashboard. Keep /dashboard as a redirect
// for anyone who bookmarked the old URL.
export default async function DashboardRedirect() {
  redirect("/");
}
