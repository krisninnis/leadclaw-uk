// AI Readiness — Competitor Benchmarking V1
// GET  /api/visibility/competitors → list the user's competitors + latest scans
// POST /api/visibility/competitors → add a competitor URL (max 5, deduped)

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { visibilityRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { normalizeAuditUrl, isUrlValidationError } from "@/lib/audit/run-audit";
import {
  addCompetitor,
  listCompetitorsWithLatestScans,
} from "@/lib/visibility/competitors-store";
import { MAX_COMPETITORS } from "@/lib/visibility/competitors-types";

// Node runtime: normalisation reuses the audit URL validator (node:net etc.).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const competitors = await listCompetitorsWithLatestScans(authed.user.id);
  return NextResponse.json({
    ok: true,
    competitors,
    max: MAX_COMPETITORS,
  });
}

const addSchema = z.object({
  url: z.string().min(3).max(2048),
  label: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const allowed = await checkRateLimit(visibilityRateLimit, authed.user.id);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  let url: string;
  let label: string | undefined;
  try {
    const json = await req.json();
    const parsed = addSchema.parse(json);
    url = parsed.url;
    label = parsed.label;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  // Reuse the audit URL validator (SSRF-safe, https-normalised origin) so a
  // competitor URL is held to the same standard as the user's own audit.
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeAuditUrl(url).origin;
  } catch (err) {
    if (isUrlValidationError(err)) {
      return NextResponse.json(
        { ok: false, error: "invalid_url", message: err.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "invalid_url" },
      { status: 400 },
    );
  }

  const cleanLabel = label?.trim() ? label.trim() : null;
  const outcome = await addCompetitor(authed.user.id, normalizedUrl, cleanLabel);

  if (!outcome.ok) {
    const status = outcome.error === "unavailable" ? 503 : 409;
    return NextResponse.json(
      { ok: false, error: outcome.error, max: MAX_COMPETITORS },
      { status },
    );
  }

  return NextResponse.json({ ok: true, competitor: outcome.competitor });
}
