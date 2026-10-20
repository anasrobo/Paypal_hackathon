import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GroundTruth — agents buy verified facts from humans",
  description:
    "An AI agent posts a physical-world verification bounty. A human photographs it. A deterministic gate decides. PayPal Payouts pays them in seconds.",
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 sm:px-6">
          <header className="flex shrink-0 items-center justify-between border-b border-line py-3">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded border border-money/40 bg-money/10 text-money">
                <span className="text-[11px] leading-none">◈</span>
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-mono text-sm tracking-tight text-text group-hover:text-money">
                  GroundTruth
                </span>
                <span className="mt-0.5 hidden text-[11px] text-faint sm:block">
                  agents buy verified facts from humans
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-overlay hover:text-text"
              >
                Console
              </Link>
              <Link
                href="/ops"
                className="rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-overlay hover:text-text"
              >
                Ops ledger
              </Link>
            </nav>
          </header>
          <main className="flex-1 py-6">{children}</main>
          <footer className="shrink-0 border-t border-line py-4">
            <p className="text-[11px] text-faint">
              PayPal AI Hackathon 2026 · sandbox only · no real money moves
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
