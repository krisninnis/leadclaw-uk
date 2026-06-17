// ClawLabsLocal — Landing Page Builder (Phase A)
// GET  /api/admin/landing-pages  → list (admin)
// POST /api/admin/landing-pages  → create draft (admin)

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { checkRateLimit, landingAdminRateLimit } from "@/lib/rate-limit";
import {
  createLandingPage,
  listLandingPages,
  slugExists,
  type ListFilters,
} from "@/lib/landing/store";
import { parseCreateInput } from "@/lib/landing/validate";
import type { LandingStatus } from "@/lib/landing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: LandingStatus[] = ["draft", "published", "archived"];

export async function GET(req: Request) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const filters: ListFilters = {
    status:
      statusParam && STATUSES.includes(statusParam as LandingStatus)
        ? (statusParam as LandingStatus)
        : undefined,
    niche: url.searchParams.get("niche") || undefined,
    city: url.searchParams.get("city") || undefined,
    search: url.searchParams.get("search") || undefined,
  };

  const pages = await listLandingPages(filters);
  return NextResponse.json({ ok: true, pages });
}

export async function POST(req: Request) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const allowed = await checkRateLimit(landingAdminRateLimit, authed.user.id);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  let input;
  try {
    const body = await req.json().catch(() => ({}));
    input = parseCreateInput(body);
  } catch (error: unknown) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message || "invalid_request"
        : error instanceof Error
          ? error.message
          : "invalid_request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  if (await slugExists(input.slug)) {
    return NextResponse.json(
      { ok: false, error: "slug_taken" },
      { status: 409 },
    );
  }

  const page = await createLandingPage(input, authed.user.id);
  if (!page) {
    return NextResponse.json(
      { ok: false, error: "create_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, page }, { status: 201 });
}
