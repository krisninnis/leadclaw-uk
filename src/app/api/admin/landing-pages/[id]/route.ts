// ClawLabsLocal — Landing Page Builder (Phase A)
// GET    /api/admin/landing-pages/[id] → fetch one (admin)
// PATCH  /api/admin/landing-pages/[id] → update draft content/metadata (admin)
// DELETE /api/admin/landing-pages/[id] → soft-delete (status='archived')

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { checkRateLimit, landingAdminRateLimit } from "@/lib/rate-limit";
import {
  getLandingPageById,
  setLandingPageStatus,
  slugExists,
  updateLandingPage,
} from "@/lib/landing/store";
import { parseUpdateInput } from "@/lib/landing/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const { id } = await ctx.params;
  const page = await getLandingPageById(id);
  if (!page) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, page });
}

export async function PATCH(req: Request, ctx: RouteContext) {
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

  let patch;
  try {
    const body = await req.json().catch(() => ({}));
    patch = parseUpdateInput(body);
  } catch (error: unknown) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message || "invalid_request"
        : error instanceof Error
          ? error.message
          : "invalid_request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  if (patch.slug && patch.slug !== existing.slug) {
    if (await slugExists(patch.slug, id)) {
      return NextResponse.json(
        { ok: false, error: "slug_taken" },
        { status: 409 },
      );
    }
  }

  const page = await updateLandingPage(id, patch, authed.user.id);
  if (!page) {
    return NextResponse.json(
      { ok: false, error: "update_failed" },
      { status: 500 },
    );
  }

  // If the page is live, surface edits immediately and refresh the sitemap if
  // the slug changed.
  if (existing.status === "published") {
    revalidatePath(`/lp/${page.slug}`);
    if (patch.slug && patch.slug !== existing.slug) {
      revalidatePath(`/lp/${existing.slug}`);
    }
    revalidatePath("/sitemap.xml");
  }

  return NextResponse.json({ ok: true, page });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
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

  const page = await setLandingPageStatus(id, "archived", authed.user.id);
  if (!page) {
    return NextResponse.json(
      { ok: false, error: "archive_failed" },
      { status: 500 },
    );
  }

  // Drop the (previously published) page from the live route + sitemap.
  revalidatePath(`/lp/${existing.slug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ ok: true, page });
}
