import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/nav";
import AppShell from "@/components/app-shell";

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
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Nav />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
