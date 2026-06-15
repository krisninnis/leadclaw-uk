// Phase 2 — AI Website Audit (V1)
// POST /api/audit/refresh — re-run the most recent audit (or a given url).
// Body: { url?: string }. If url is omitted, the user's latest audited URL
// is re-run, producing a new history entry.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { auditRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { runAudit, isUrlValidationError } from "@/lib/audit/run-audit";
import { getLatestAudit, saveAudit } from "@/lib/audit/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().min(3).max(2048).optional(),
});

export async function POST(req: Request) {
  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const allowed = await checkRateLimit(auditRateLimit, authed.user.id);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  let url: string | undefined;
  try {
    const json = await req.json().catch(() => ({}));
    url = schema.parse(json).url;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  if (!url) {
    const latest = await getLatestAudit(authed.user.id);
    if (!latest) {
      return NextResponse.json(
        { ok: false, error: "no_previous_audit" },
        { status: 400 },
      );
    }
    url = latest.input_url || latest.website_url;
  }

  try {
    const result = await runAudit(url);
    const saved = await saveAudit(authed.user.id, result);
    return NextResponse.json({
      ok: true,
      audit: saved,
      result: saved ? undefined : result,
    });
  } catch (err) {
    if (isUrlValidationError(err)) {
      return NextResponse.json(
        { ok: false, error: "invalid_url", message: err.message },
        { status: 400 },
      );
    }
    console.error("[audit] refresh failed", err);
    return NextResponse.json(
      { ok: false, error: "audit_failed" },
      { status: 500 },
    );
  }
}
