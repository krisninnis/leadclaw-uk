// AI Readiness — Competitor Benchmarking V1
// Runs an AI-readiness scan for a competitor URL by reusing the EXISTING
// pipeline: the Phase 2 website audit (runAudit — fetch + SSRF-guarded crawl +
// checks) feeds the SAME readiness scoring as the user's own report
// (calculateVisibilityScore + generateVisibilityRecommendations). This keeps
// the comparison apples-to-apples and needs no new crawler.
//
// Every scan is fail-safe: a competitor whose site is unreachable (or whose URL
// fails validation) yields a "failed" CompetitorScanResult instead of throwing,
// so one bad competitor never breaks the whole benchmark.

import { runAudit, isUrlValidationError } from "@/lib/audit/run-audit";
import { calculateVisibilityScore } from "./score";
import { generateVisibilityRecommendations } from "./recommendations";
import {
  COMPETITOR_ENGINE_VERSION,
  MAX_COMPETITORS,
  ZERO_VISIBILITY_SCORES,
  type CompetitorScanResult,
} from "./competitors-types";

// Audit the competitor URL and reuse the readiness scorer. Runs the same number
// of fetches as a normal audit, so it is gated behind a tight rate limit at the
// route layer. Never throws.
export async function runCompetitorScan(
  websiteUrl: string,
): Promise<CompetitorScanResult> {
  const scannedAt = new Date().toISOString();

  let audit: Awaited<ReturnType<typeof runAudit>>;
  try {
    audit = await runAudit(websiteUrl);
  } catch (err) {
    return failedScan(
      websiteUrl,
      scannedAt,
      isUrlValidationError(err)
        ? err.message
        : "We couldn't reach this competitor's site.",
    );
  }

  if (audit.status === "failed") {
    return failedScan(
      audit.websiteUrl || websiteUrl,
      scannedAt,
      audit.error ?? "The competitor site could not be loaded.",
      audit.engineVersion ?? null,
      audit.meta?.statusCode ?? null,
    );
  }

  const { scores, breakdown } = calculateVisibilityScore(audit.checks);
  const recommendations = generateVisibilityRecommendations(breakdown);

  return {
    websiteUrl: audit.websiteUrl,
    status: "completed",
    error: null,
    scores,
    recommendations,
    meta: {
      engineVersion: COMPETITOR_ENGINE_VERSION,
      sourceAuditId: null,
      auditEngineVersion: audit.engineVersion ?? null,
      auditStatusCode: audit.meta?.statusCode ?? null,
      scannedAt,
      breakdown,
    },
  };
}

function failedScan(
  websiteUrl: string,
  scannedAt: string,
  error: string,
  auditEngineVersion: string | null = null,
  auditStatusCode: number | null = null,
): CompetitorScanResult {
  return {
    websiteUrl,
    status: "failed",
    error,
    scores: { ...ZERO_VISIBILITY_SCORES },
    recommendations: [],
    meta: {
      engineVersion: COMPETITOR_ENGINE_VERSION,
      sourceAuditId: null,
      auditEngineVersion,
      auditStatusCode,
      scannedAt,
      breakdown: { categories: [] },
    },
  };
}

export type BenchmarkRunItem = {
  competitorId: string;
  websiteUrl: string;
  result: CompetitorScanResult;
};

// How many competitor audits run at once. Kept low so a benchmark is gentle on
// both our egress and the competitor sites; combined with the route rate limit.
const COMPETITOR_SCAN_CONCURRENCY = 3;

// Benchmark a set of competitors (capped at MAX_COMPETITORS). Each competitor is
// scanned independently and fail-safe, so the returned list always covers every
// input competitor — failures are reported per-item, never as a thrown error.
export async function benchmarkCompetitors(
  competitors: { id: string; website_url: string }[],
): Promise<BenchmarkRunItem[]> {
  const targets = competitors.slice(0, MAX_COMPETITORS);
  return mapWithConcurrency(
    targets,
    COMPETITOR_SCAN_CONCURRENCY,
    async (c): Promise<BenchmarkRunItem> => {
      try {
        return {
          competitorId: c.id,
          websiteUrl: c.website_url,
          result: await runCompetitorScan(c.website_url),
        };
      } catch (err) {
        // Defensive: runCompetitorScan already swallows errors, but never let a
        // single competitor break the batch.
        console.error("[competitors] unexpected scan failure", err);
        return {
          competitorId: c.id,
          websiteUrl: c.website_url,
          result: failedScan(
            c.website_url,
            new Date().toISOString(),
            "We couldn't check this competitor. Please try again.",
          ),
        };
      }
    },
  );
}

// Small fixed-size worker pool: preserves input order, bounds concurrency.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  const size = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}
