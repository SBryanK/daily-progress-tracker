import { redirect } from "next/navigation";

// AI summary now lives on the home page at the bottom.
export default async function SummaryRedirect() {
  redirect("/#ai-summary-heading");
}
