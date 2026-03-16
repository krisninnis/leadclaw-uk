import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "LeadClaw | AI front desk for aesthetic clinics",
  description:
    "LeadClaw captures missed website enquiries for aesthetic clinics using an AI front desk, turning visitors into leads automatically.",

  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Nav />

        {/* Main content area */}
        <main className="mx-auto w-full max-w-[1400px] px-6 pb-28 pt-6 md:pl-[360px] md:pr-10 md:pt-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-white/80 backdrop-blur-sm md:ml-[320px]">
          <div className="container-shell flex flex-wrap items-center gap-4 py-6 text-xs text-muted">
            <Link
              href="/legal/terms"
              className="transition-colors hover:text-foreground"
            >
              Terms
            </Link>

            <Link
              href="/legal/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>

            <Link
              href="/legal/trial-waiver"
              className="transition-colors hover:text-foreground"
            >
              Trial Terms
            </Link>

            <Link
              href="/legal/dpa"
              className="transition-colors hover:text-foreground"
            >
              DPA
            </Link>

            <Link
              href="/legal/compliance-checklist"
              className="transition-colors hover:text-foreground"
            >
              Compliance
            </Link>

            <span className="ml-auto text-muted-2">
              © {new Date().getFullYear()} LeadClaw AI
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
