// AI Readiness — Competitor Benchmarking V1
// Shared types for competitor tracking, competitor scans, and the benchmark
// summary. Pure type module (no server / DB / network imports) so the pure
// benchmark maths, the persistence layer, and the UI can all import it freely.

import type {
  VisibilityBreakdown,
  VisibilityCategory,
  VisibilityRecommendation,
  VisibilityScores,
} from "./types";

export const COMPETITOR_ENGINE_VERSION = "v1";

// Product limits for V1: a user benchmarks against 1–5 competitor sites.
export const MAX_COMPETITORS = 5;
export const MIN_BENCHMARK_COMPETITORS = 1;

// Run metadata persisted in ai_visibility_competitor_scans.meta. Owned by the
// app so the scoring framework can evolve without a schema change.
export type CompetitorScanMeta = {
  engineVersion: string;
  // Always null in V1 (competitor audits are not persisted to website_audits).
  // Reserved so a future phase can link a persisted audit without a migration.
  sourceAuditId: string | null;
  // Provenance from the underlying audit run.
  auditEngineVersion: string | null;
  auditStatusCode: number | null;
  // When this scan was computed.
  scannedAt: string;
  // Full per-category factor breakdown (empty categories for a failed scan).
  breakdown: VisibilityBreakdown;
  notes?: string[];
};

// Result produced by runCompetitorScan(), ready to persist. Mirrors the user's
// own ScanResult shape so the comparison is apples-to-apples.
export type CompetitorScanResult = {
  websiteUrl: string;
  status: "completed" | "failed";
  error: string | null;
  scores: VisibilityScores;
  recommendations: VisibilityRecommendation[];
  meta: CompetitorScanMeta;
};

// Row shape returned to the UI (subset of the ai_visibility_competitors row).
export type AiVisibilityCompetitorRow = {
  id: string;
  user_id: string;
  website_url: string;
  label: string | null;
  created_at: string;
  updated_at: string;
};

// Row shape returned to the UI (subset of ai_visibility_competitor_scans).
export type AiVisibilityCompetitorScanRow = {
  id: string;
  user_id: string;
  competitor_id: string;
  source_audit_id: string | null;
  website_url: string;
  status: string;
  error: string | null;
  scores: VisibilityScores;
  recommendations: VisibilityRecommendation[];
  meta: CompetitorScanMeta;
  created_at: string;
};

// A competitor together with its most recent scan (null if never run).
export type CompetitorWithScan = {
  competitor: AiVisibilityCompetitorRow;
  latestScan: AiVisibilityCompetitorScanRow | null;
};

// Zeroed scores used for a failed competitor scan (site unreachable). Kept so a
// failed competitor still has a well-typed scores object.
export const ZERO_VISIBILITY_SCORES: VisibilityScores = {
  visibility_score: 0,
  content_score: 0,
  authority_score: 0,
  citation_score: 0,
  schema_score: 0,
};

// ---------------------------------------------------------------------------
// Benchmark summary — pure, computed from your scan + your competitors' scans.
// ---------------------------------------------------------------------------

// One category where competitors outperform you, with the estimated gain to
// your OVERALL readiness score from matching the best competitor there.
export type BenchmarkGap = {
  category: VisibilityCategory;
  categoryLabel: string;
  yourScore: number;
  competitorBest: number;
  competitorBestLabel: string;
  competitorAverage: number;
  // Category points you are behind the best competitor (always > 0).
  gap: number;
  // Estimated gain to your OVERALL score if you match the best competitor in
  // this category (each category is an equal slice of the overall score).
  estimatedPointGain: number;
};

export type BenchmarkSummary = {
  yourScore: number;
  // Mean overall score across scored competitors (null if none scored).
  competitorAverage: number | null;
  best: { websiteUrl: string; label: string; score: number } | null;
  worst: { websiteUrl: string; label: string; score: number } | null;
  // 1-based rank of "you" among you + scored competitors (1 = leader).
  yourRank: number | null;
  // you + scored competitors.
  fieldSize: number;
  // max(0, best competitor score - your score). 0 when you lead.
  gapToLeader: number;
  scoredCompetitorCount: number;
  // Categories where competitors beat you, biggest gap first.
  topGaps: BenchmarkGap[];
};
