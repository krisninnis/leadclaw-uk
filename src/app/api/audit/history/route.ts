// Phase 2 — AI Website Audit (V1)
// GET /api/audit/history[?limit=] — audit history for the authenticated user,
// newest first.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getAuditHistory } from "@/lib/audit/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 25;

  const audits = await getAuditHistory(authed.user.id, limit);
  return NextResponse.json({ ok: true, audits });
}
