import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "Claw AI Clinics",
  description: "No-call AI front desk SaaS for UK aesthetic clinics",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Nav />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:pl-80 md:pr-8 md:pt-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white/80 md:ml-72">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-4 px-4 py-5 text-xs text-slate-600 md:px-8">
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/trial-waiver">Trial Terms</Link>
            <Link href="/legal/dpa">DPA</Link>
            <Link href="/legal/compliance-checklist">Compliance</Link>
            <span className="ml-auto">
              © {new Date().getFullYear()} LeadClaw AI
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
