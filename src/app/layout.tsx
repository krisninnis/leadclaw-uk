import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import Nav from "@/components/nav";
import AppShell from "@/components/app-shell";
import PHProvider from "@/components/posthog-provider";

export const metadata: Metadata = {
  title: "LeadClaw | AI workflow automation suite",
  description:
    "LeadClaw helps businesses capture requests, organise operational work, automate follow-ups, and save hours on repetitive admin and data tasks with AI.",
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://www.leadclaw.uk"),
  openGraph: {
    type: "website",
    url: "https://www.leadclaw.uk",
    siteName: "LeadClaw",
    title: "LeadClaw | AI workflow automation suite",
    description:
      "Capture requests, organise work, automate follow-ups, and reduce repetitive admin with LeadClaw's AI workflow tools.",
    images: [
      {
        url: "/brand/mascots/panther-growth.jpg",
        width: 1200,
        height: 630,
        alt: "LeadClaw AI workflow automation suite",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadClaw | AI workflow automation suite",
    description:
      "Capture requests, organise work, automate follow-ups, and reduce repetitive admin with LeadClaw.",
    images: ["/brand/mascots/panther-growth.jpg"],
  },
  keywords: [
    "AI workflow automation",
    "AI receptionist",
    "lead tracker",
    "automated follow-up assistant",
    "data cleaner",
    "document extractor",
    "weekly report bot",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        ) : null}

        <PHProvider>
          <Nav />
          <AppShell>{children}</AppShell>
        </PHProvider>
      </body>
    </html>
  );
}
