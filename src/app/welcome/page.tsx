import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { WelcomeCards } from "./welcome-cards";
import { ROLE_COOKIE } from "./constants";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const safeNext =
    sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : "/";

  const jar = (await cookies()) as unknown as {
    get: (name: string) => { value: string } | undefined;
  };
  const existing = jar.get(ROLE_COOKIE)?.value;
  if (existing === "owner" || existing === "visitor") {
    redirect(safeNext);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-bg">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(0,82,217,0.18),transparent_60%)] dark:bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(56,134,255,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_90%_110%,rgba(0,82,217,0.10),transparent_60%)] dark:bg-[radial-gradient(800px_400px_at_90%_110%,rgba(56,134,255,0.12),transparent_60%)]" />
      </div>
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg transition-colors"
        >
          <Image src="/brand/t.svg" alt="" width={20} height={26} className="h-6 w-auto" priority />
          <span className="font-semibold tracking-tight text-fg">Bryan&rsquo;s Daily Progress</span>
        </Link>
        <header className="mb-8 sm:mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-fg">Welcome</h1>
          <p className="mt-3 text-[14px] sm:text-[15px] leading-relaxed text-fg-muted max-w-prose mx-auto">
            How would you like to continue? We&rsquo;ll remember your choice on this browser for one year so you don&rsquo;t see this screen on every visit.
          </p>
        </header>
        <WelcomeCards next={safeNext} />
      </div>
    </main>
  );
}
