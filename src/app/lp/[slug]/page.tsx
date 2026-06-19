// ClawLabsLocal — Landing Page Builder (Phase A)
// Public, DB-driven local landing page. Serves ONLY status='published' rows;
// drafts / archived / unknown slugs return notFound(). Statically cached with
// ISR (revalidate hourly) and refreshed on demand by the publish/unpublish API
// via revalidatePath('/lp/<slug>').

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicLandingPage from "@/components/landing/public-landing-page";
import {
  getPublishedLandingPage,
  listPublishedSlugs,
} from "@/lib/landing/store";

const siteUrl = "https://www.leadclaw.uk";
const defaultOgImage = "/brand/og/leadclaw-og.png";

// Statically cache published pages; refresh hourly and on publish/unpublish.
export const revalidate = 3600;
// Allow on-demand rendering of slugs not known at build time.
export const dynamicParams = true;

type RouteProps = {
  params: Promise<{ slug: string }>;
};

// Build-safe: returns [] when the service-role client is unavailable (no DB
// creds at build), so `next build` never fails — new slugs render on demand.
export async function generateStaticParams() {
  const slugs = await listPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedLandingPage(slug);
  if (!page) return {};

  const canonicalPath = page.canonical_path || `/lp/${page.slug}`;
  const url = `${siteUrl}${canonicalPath}`;
  const index = page.status === "published" && !page.noindex;
  const title = page.seo_title || page.content.h1 || page.slug;
  const description = page.seo_description || page.content.subheading || "";
  const ogImage = page.og_image_path || defaultOgImage;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index, follow: index },
    openGraph: {
      type: "website",
      url,
      siteName: "LeadClaw",
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function LandingPageRoute({ params }: RouteProps) {
  const { slug } = await params;
  const page = await getPublishedLandingPage(slug);
  if (!page) notFound();

  return <PublicLandingPage page={page} />;
}
