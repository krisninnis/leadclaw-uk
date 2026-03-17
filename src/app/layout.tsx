import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/nav";
import AppFooter from "@/components/app-footer";

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

        <main className="mx-auto w-full max-w-[1400px] px-6 pb-28 pt-6 md:pl-[360px] md:pr-10 md:pt-8">
          {children}
        </main>

        <AppFooter />
      </body>
    </html>
  );
}
