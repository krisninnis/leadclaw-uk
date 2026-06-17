// ClawLabsLocal — Landing Page Builder (Phase A)
// Admin-only preview of a draft (or any) page through the REAL public template,
// so "what you preview is what publishes". Always noindex; never reachable by
// anon users (gated by requireAdminPageUser).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPageUser } from "../../admin-access";
import { getLandingPageById } from "@/lib/landing/store";
import PublicLandingPage from "@/components/landing/public-landing-page";
import type { PublicLandingPage as PublicLandingPageData } from "@/lib/landing/types";

export const dynamic = "force-dynamic";

// Preview must never be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function PreviewLandingPage({ params }: Props) {
  await requireAdminPageUser();
  const { id } = await params;
  const page = await getLandingPageById(id);
  if (!page) notFound();

  // Map the admin row to the public renderer's safe shape.
  const publicData: PublicLandingPageData = {
    id: page.id,
    slug: page.slug,
    status: page.status,
    niche: page.niche,
    city: page.city,
    region: page.region,
    country: page.country,
    seo_title: page.seo_title,
    seo_description: page.seo_description,
    canonical_path: page.canonical_path,
    og_image_path: page.og_image_path,
    noindex: page.noindex,
    content: page.content,
    business_schema: page.business_schema,
    published_at: page.published_at,
    updated_at: page.updated_at,
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900">
          DRAFT preview — not public, noindex. Status: {page.status}.
        </p>
        <Link
          href={`/admin/landing-pages/${page.id}`}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          Back to editor
        </Link>
      </div>

      <PublicLandingPage page={publicData} />
    </div>
  );
}
