// Phase 2 — AI Website Audit (V1)
// POST /api/audit/run — run a fresh audit for the authenticated user.
// Body: { url: string }

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { auditRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { runAudit, isUrlValidationError } from "@/lib/audit/run-audit";
import { saveAudit } from "@/lib/audit/store";

// Node runtime: we make outbound fetches and read raw response bodies.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().min(3).max(2048),
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

  let url: string;
  try {
    const json = await req.json();
    url = schema.parse(json).url;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    const result = await runAudit(url);
    const saved = await saveAudit(authed.user.id, result);

    return NextResponse.json({
      ok: true,
      audit: saved,
      // Always return the computed result even if persistence is unavailable.
      result: saved ? undefined : result,
    });
  } catch (err) {
    if (isUrlValidationError(err)) {
      return NextResponse.json(
        { ok: false, error: "invalid_url", message: err.message },
        { status: 400 },
      );
    }
    console.error("[audit] run failed", err);
    return NextResponse.json(
      { ok: false, error: "audit_failed" },
      { status: 500 },
    );
  }
}
