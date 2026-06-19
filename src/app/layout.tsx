import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import Nav from "@/components/nav";
import AppShell from "@/components/app-shell";
import PHProvider from "@/components/posthog-provider";

export const metadata: Metadata = {
  title: "LeadClaw | AI Receptionist for UK Businesses",
  description:
    "LeadClaw is AI receptionist software for UK businesses and clinics. Capture enquiries, recover missed calls, follow up faster, and book more appointments.",
  // Icons are auto-generated from src/app/favicon.ico, icon.png and apple-icon.png
  // via the Next.js file conventions, so no manual `icons` config is needed.
  metadataBase: new URL("https://www.leadclaw.uk"),
  openGraph: {
    type: "website",
    url: "https://www.leadclaw.uk",
    siteName: "LeadClaw",
    title: "LeadClaw | AI Receptionist for UK Businesses",
    description:
      "Capture enquiries, recover missed calls, follow up faster, and book more appointments with LeadClaw's AI receptionist.",
    images: [
      {
        url: "/brand/og/leadclaw-og.png",
        width: 1200,
        height: 630,
        alt: "LeadClaw — AI receptionist software for UK businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadClaw | AI Receptionist for UK Businesses",
    description:
      "Capture enquiries, recover missed calls, and follow up faster with LeadClaw.",
    images: ["/brand/og/leadclaw-og.png"],
  },
  keywords: [
    "AI receptionist",
    "AI receptionist UK",
    "AI receptionist software",
    "missed call recovery",
    "lead capture",
    "appointment booking",
    "clinic receptionist software",
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

        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "x5floekpn9");
          `}
        </Script>

        <PHProvider>
          <Nav />
          <AppShell>{children}</AppShell>
        </PHProvider>
      </body>
    </html>
  );
}
