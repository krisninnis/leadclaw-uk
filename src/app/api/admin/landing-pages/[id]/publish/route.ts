// ClawLabsLocal — Landing Page Builder (Phase A)
// POST /api/admin/landing-pages/[id]/publish
// Runs the publish gate, flips status draft→published, stamps published_at,
// and revalidates the public path + sitemap.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { checkRateLimit, landingAdminRateLimit } from "@/lib/rate-limit";
import {
  getLandingPageById,
  setLandingPageStatus,
  slugExists,
} from "@/lib/landing/store";
import { validatePublish } from "@/lib/landing/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const allowed = await checkRateLimit(landingAdminRateLimit, authed.user.id);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  const { id } = await ctx.params;
  const page = await getLandingPageById(id);
  if (!page) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  // Slug must still be unique among other rows.
  if (await slugExists(page.slug, id)) {
    return NextResponse.json(
      { ok: false, error: "slug_taken" },
      { status: 409 },
    );
  }

  const validation = validatePublish({
    slug: page.slug,
    city: page.city,
    seo_title: page.seo_title,
    seo_description: page.seo_description,
    content: page.content,
    business_schema: page.business_schema,
  });

  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_failed",
        issues: validation.issues,
        wordCount: validation.wordCount,
      },
      { status: 422 },
    );
  }

  const updated = await setLandingPageStatus(id, "published", authed.user.id);
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "publish_failed" },
      { status: 500 },
    );
  }

  revalidatePath(`/lp/${updated.slug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ ok: true, page: updated });
}
