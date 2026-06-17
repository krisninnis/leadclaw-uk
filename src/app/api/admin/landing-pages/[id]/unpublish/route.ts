// ClawLabsLocal — Landing Page Builder (Phase A)
// POST /api/admin/landing-pages/[id]/unpublish
// Flips status published→draft, clears published_at, and revalidates the
// public path + sitemap so the page stops serving.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { checkRateLimit, landingAdminRateLimit } from "@/lib/rate-limit";
import { getLandingPageById, setLandingPageStatus } from "@/lib/landing/store";

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
  const existing = await getLandingPageById(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  const page = await setLandingPageStatus(id, "draft", authed.user.id);
  if (!page) {
    return NextResponse.json(
      { ok: false, error: "unpublish_failed" },
      { status: 500 },
    );
  }

  revalidatePath(`/lp/${existing.slug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ ok: true, page });
}
