import type { Metadata } from "next";
import type { SeoPage } from "@/lib/seo-pages";

const siteUrl = "https://www.leadclaw.uk";
const ogImage = "/brand/mascots/panther-growth.jpg";

export function buildSeoPageMetadata(page: SeoPage): Metadata {
  const url = `${siteUrl}${page.canonicalPath}`;

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: {
      canonical: page.canonicalPath,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      url,
      siteName: "LeadClaw",
      title: page.title,
      description: page.metaDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "LeadClaw AI receptionist software",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.metaDescription,
      images: [ogImage],
    },
  };
}
