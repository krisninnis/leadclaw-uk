// Phase 2 — AI Website Audit (V1)
// GET /api/audit/latest[?url=] — newest audit for the authenticated user,
// optionally scoped to a specific audited origin.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getLatestAudit } from "@/lib/audit/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const url = new URL(req.url).searchParams.get("url") || undefined;
  const audit = await getLatestAudit(authed.user.id, url);

  return NextResponse.json({ ok: true, audit });
}
