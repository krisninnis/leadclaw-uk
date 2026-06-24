import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONTENT_BACKLOG,
  isContentStatus,
} from "@/lib/seo/content-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only write endpoint for the SEO Content Queue.
//
// POST /api/admin/seo-content/[slug]
//   Upserts a workflow status for a backlog opportunity into seo_content_status
//   (keyed by opportunity_slug). It writes ONLY to that additive overlay table —
//   nothing else. No public access. The opportunity catalogue itself stays in
//   code and is never mutated.
//
// Body (at least one of):
//   status         backlog | planned | in_progress | published
//   notes          string | null
//   published_url  string | null

type RouteContext = { params: Promise<{ slug: string }> };

type UpdateBody = {
  status?: unknown;
  notes?: unknown;
  published_url?: unknown;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

// Slugs are the engine's stable keys; only accept ones that actually exist in
// the curated backlog so the overlay can never drift from the catalogue.
const KNOWN_SLUGS = new Set(CONTENT_BACKLOG.map((o) => o.slug));

export async function POST(req: NextRequest, ctx: RouteContext) {
  const authed = await requireAdmin();
  if (!authed.ok) return authed.response;

  const { slug } = await ctx.params;
  if (!slug || !SLUG_RE.test(slug)) return badRequest("invalid_slug");
  if (!KNOWN_SLUGS.has(slug)) return badRequest("unknown_opportunity");

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return badRequest("invalid_json");
  }

  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!isContentStatus(body.status)) return badRequest("invalid_status");
    patch.status = body.status;
  }
  if (body.notes !== undefined) {
    if (body.notes === null) patch.notes = null;
    else if (typeof body.notes === "string") {
      if (body.notes.length > 5000) return badRequest("notes_too_long");
      patch.notes = body.notes;
    } else return badRequest("invalid_notes");
  }
  if (body.published_url !== undefined) {
    if (body.published_url === null) patch.published_url = null;
    else if (typeof body.published_url === "string") {
      if (body.published_url.length > 500) return badRequest("url_too_long");
      patch.published_url = body.published_url;
    } else return badRequest("invalid_published_url");
  }

  if (Object.keys(patch).length === 0) return badRequest("no_fields");

  const admin = createAdminClient({ optional: true });
  if (!admin) return badRequest("supabase_not_configured");
  const a = admin as unknown as SupabaseUntypedClient;

  try {
    const row = { opportunity_slug: slug, ...patch };
    const res = await a
      .from("seo_content_status")
      .upsert(row, { onConflict: "opportunity_slug" })
      .select("opportunity_slug,status,notes,published_url,updated_at")
      .maybeSingle();

    if (res.error) {
      return NextResponse.json(
        { ok: false, error: res.error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, status: res.data });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "seo_content_update_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
