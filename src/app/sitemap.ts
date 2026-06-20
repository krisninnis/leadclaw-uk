import { MetadataRoute } from "next";
import { aiReceptionistPages } from "@/lib/ai-receptionist-pages";
import { seoArticlePages } from "@/lib/seo-article-pages";
import { seoPages } from "@/lib/seo-pages";
import { listPublishedForSitemap } from "@/lib/landing/store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.leadclaw.uk";
  const lastModified = new Date();

  // ClawLabsLocal — published, non-noindex /lp pages. Build-safe: returns []
  // when the DB is unavailable so the sitemap never fails to generate.
  const landingPages: MetadataRoute.Sitemap = (
    await listPublishedForSitemap()
  ).map((page) => ({
    url: `${baseUrl}${page.canonical_path || `/lp/${page.slug}`}`,
    lastModified: page.updated_at ? new Date(page.updated_at) : lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    ...landingPages,
    // Core marketing pages - highest priority
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/demo`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/help`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/industries`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/apply`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/free-trial`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Primary AI receptionist SEO pages - highest SEO priority
    ...aiReceptionistPages.map((page) => ({
      url: `${baseUrl}${page.canonicalPath}`,
      lastModified,
      changeFrequency:
        page.slug === "ai-receptionist-uk"
          ? ("weekly" as const)
          : ("monthly" as const),
      priority: page.slug === "ai-receptionist-uk" ? 0.95 : 0.9,
    })),
    {
      url: `${baseUrl}/compare`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/resources`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/best-ai-receptionist-uk`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    ...seoArticlePages.map((page) => ({
      url: `${baseUrl}${page.canonicalPath}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.82,
    })),
    // SEO landing pages - high priority
    {
      url: `${baseUrl}/seo/ai-agent-for-aesthetic-clinics-uk`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/seo/ai-agent-for-dental-clinics-uk`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/seo/missed-call-recovery-uk`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...seoPages.map((page) => ({
      url: `${baseUrl}${page.canonicalPath}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // Legal pages - low priority
    {
      url: `${baseUrl}/legal/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/trial-waiver`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/legal/dpa`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/legal/compliance-checklist`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
