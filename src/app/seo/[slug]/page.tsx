import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SeoLandingPage from "@/components/seo/seo-landing-page";
import { getSeoPage, seoPages } from "@/lib/seo-pages";

const siteUrl = "https://www.leadclaw.uk";
const ogImage = "/brand/og/leadclaw-og.png";

type SeoRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return seoPages.map((page) => ({
    slug: page.slug,
  }));
}

export async function generateMetadata({
  params,
}: SeoRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPage(slug);

  if (!page) {
    return {};
  }

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

export default async function SeoPage({ params }: SeoRouteProps) {
  const { slug } = await params;
  const page = getSeoPage(slug);

  if (!page) {
    notFound();
  }

  return <SeoLandingPage page={page} />;
}
