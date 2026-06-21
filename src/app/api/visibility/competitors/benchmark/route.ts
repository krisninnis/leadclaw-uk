// AI Readiness — Competitor Benchmarking V1
// POST /api/visibility/competitors/benchmark → audit every saved competitor and
// store a fresh readiness scan for each. Fail-safe per competitor (one bad site
// never breaks the run) and returns partial results so the UI can refresh.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  competitorBenchmarkRateLimit,
  checkRateLimit,
} from "@/lib/rate-limit";
import {
  listCompetitors,
  saveCompetitorScan,
} from "@/lib/visibility/competitors-store";
import { benchmarkCompetitors } from "@/lib/visibility/competitors";

// Node runtime + a generous duration: each run audits up to 5 competitor sites.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const authed = await requireUser();
  if (!authed.ok) return authed.response;

  const allowed = await checkRateLimit(
    competitorBenchmarkRateLimit,
    authed.user.id,
  );
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  const competitors = await listCompetitors(authed.user.id);
  if (competitors.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no_competitors" },
      { status: 409 },
    );
  }

  // Each competitor is scanned independently and fail-safe.
  const runs = await benchmarkCompetitors(
    competitors.map((c) => ({ id: c.id, website_url: c.website_url })),
  );

  // Persist each scan. A persistence failure is reported per-item but does not
  // fail the whole response — partial results are still useful.
  const results = await Promise.all(
    runs.map(async (run) => {
      const saved = await saveCompetitorScan(
        authed.user.id,
        run.competitorId,
        run.result,
      );
      return {
        competitorId: run.competitorId,
        websiteUrl: run.websiteUrl,
        status: run.result.status,
        error: run.result.error,
        score:
          run.result.status === "completed"
            ? run.result.scores.visibility_score
            : null,
        persisted: Boolean(saved),
      };
    }),
  );

  const completed = results.filter((r) => r.status === "completed").length;

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    total: results.length,
    completed,
    failed: results.length - completed,
    results,
  });
}
