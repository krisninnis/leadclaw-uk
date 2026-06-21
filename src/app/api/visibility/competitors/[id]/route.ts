// AI Readiness — Competitor Benchmarking V1
// DELETE /api/visibility/competitors/[id] → remove a competitor (cascades scans)

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { deleteCompetitor } from "@/lib/visibility/competitors-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: RouteContext) {
  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }

  const ok = await deleteCompetitor(authed.user.id, id);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "delete_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
