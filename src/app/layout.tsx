import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/nav";
import AppShell from "@/components/app-shell";
import SentryProvider from "@/components/sentry-provider";

export const metadata: Metadata = {
  title: "LeadClaw | AI front desk for aesthetic clinics",
  description:
    "LeadClaw captures missed website enquiries for aesthetic clinics using an AI front desk, turning visitors into leads automatically.",
  icons: {
    icon: "/favicon.png",
  },
  metadataBase: new URL("https://www.leadclaw.uk"),
  openGraph: {
    type: "website",
    url: "https://www.leadclaw.uk",
    siteName: "LeadClaw",
    title: "LeadClaw | AI front desk for aesthetic clinics",
    description:
      "Stop losing clinic enquiries out of hours. LeadClaw adds an AI front desk to your clinic website that captures leads 24/7 and sends them straight to your team.",
    images: [
      {
        url: "/brand/mascots/panther-growth.jpg",
        width: 1200,
        height: 630,
        alt: "LeadClaw AI front desk for UK aesthetic clinics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadClaw | AI front desk for aesthetic clinics",
    description:
      "Stop losing clinic enquiries out of hours. LeadClaw adds an AI front desk to your clinic website that captures leads 24/7.",
    images: ["/brand/mascots/panther-growth.jpg"],
  },
  keywords: [
    "aesthetic clinic software UK",
    "AI receptionist for clinics",
    "clinic lead capture",
    "missed enquiry recovery",
    "beauty clinic automation",
    "UK aesthetic clinic management",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SentryProvider />
        <Nav />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
