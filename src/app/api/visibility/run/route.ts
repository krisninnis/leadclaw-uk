// Phase 3 — AI Visibility (Foundation)
// POST /api/visibility/run — generate a fresh AI-readiness scan for the
// authenticated user, derived from their latest website audit.
// Body: { url?: string }  (optional — defaults to the user's most recent audit)

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { visibilityRateLimit, checkRateLimit } from "@/lib/rate-limit";
import {
  runVisibilityScan,
  isNoAuditError,
  isAuditFailedError,
} from "@/lib/visibility/run-scan";
import { persistScanOnce } from "@/lib/visibility/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().min(3).max(2048).optional(),
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

  let url: string | undefined;
  try {
    // Body is optional; tolerate an empty request.
    const json = await req.json().catch(() => ({}));
    url = schema.parse(json ?? {}).url;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    const result = await runVisibilityScan(authed.user.id, url);
    // Reuse an existing scan for the same source audit instead of creating a
    // duplicate history entry (the audit hasn't changed -> the score is identical).
    const { scan: saved, reused } = await persistScanOnce(authed.user.id, result);

    return NextResponse.json({
      ok: true,
      scan: saved,
      reused,
      // Always return the computed result even if persistence is unavailable.
      result: saved ? undefined : result,
    });
  } catch (err) {
    if (isNoAuditError(err)) {
      return NextResponse.json(
        { ok: false, error: "no_audit", message: err.message },
        { status: 409 },
      );
    }
    if (isAuditFailedError(err)) {
      return NextResponse.json(
        { ok: false, error: "audit_failed", message: err.message },
        { status: 409 },
      );
    }
    console.error("[visibility] scan failed", err);
    return NextResponse.json(
      { ok: false, error: "scan_failed" },
      { status: 500 },
    );
  }
}
