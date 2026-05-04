import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Daily Progress Tracker",
  description: "Personal work progress tracker — add entries, share with your manager, export reports.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef4ff" },
    { media: "(prefers-color-scheme: dark)", color: "#07101f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Inline script avoids the FOUC for dark mode.
  const themeInit = `
    try {
      var t = localStorage.getItem('theme');
      if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (t === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
  `;
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="font-sans bg-bg text-fg antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
