// AI Readiness — Competitor Benchmarking V1
// Pure benchmark maths. No DB, no network — turns your latest readiness scan
// and your competitors' latest scans into a comparison summary (competitor
// average, best, worst, your rank, gap to leader) plus the category gaps where
// competitors outperform you and the estimated overall-score gain from closing
// each. Pure so it is trivially unit-testable and safe to import anywhere.

import {
  VISIBILITY_CATEGORIES,
  VISIBILITY_CATEGORY_LABELS,
  VISIBILITY_CATEGORY_WEIGHTS,
  visibilityCategoryScoreKey,
  type VisibilityCategory,
  type VisibilityScores,
} from "./types";
import type {
  BenchmarkGap,
  BenchmarkSummary,
  CompetitorWithScan,
} from "./competitors-types";

const round = (n: number) => Math.round(n);

// Total category weight — the denominator for the equal-weighted overall score.
const TOTAL_CATEGORY_WEIGHT =
  VISIBILITY_CATEGORIES.reduce(
    (sum, c) => sum + VISIBILITY_CATEGORY_WEIGHTS[c],
    0,
  ) || 1;

type ScoredCompetitor = {
  websiteUrl: string;
  label: string;
  scores: VisibilityScores;
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function competitorLabel(c: CompetitorWithScan): string {
  return c.competitor.label?.trim() || hostOf(c.competitor.website_url);
}

// Keep only competitors with a completed scan we can actually compare against.
function scoredCompetitors(
  competitors: CompetitorWithScan[],
): ScoredCompetitor[] {
  const out: ScoredCompetitor[] = [];
  for (const c of competitors) {
    const scan = c.latestScan;
    if (scan && scan.status === "completed" && scan.scores) {
      out.push({
        websiteUrl: c.competitor.website_url,
        label: competitorLabel(c),
        scores: scan.scores,
      });
    }
  }
  return out;
}

// Estimated gain to the OVERALL score from matching the best competitor in one
// category: that category is weight/total of the overall, so a `gap`
// category-point rise lifts the overall by gap * weight / total.
function overallGainFromCategory(
  category: VisibilityCategory,
  gap: number,
): number {
  const weight = VISIBILITY_CATEGORY_WEIGHTS[category];
  return round((gap * weight) / TOTAL_CATEGORY_WEIGHT);
}

// Per-category: where do competitors (best + average) beat you, and by how much?
export function computeTopGaps(
  yourScores: VisibilityScores,
  competitors: ScoredCompetitor[],
): BenchmarkGap[] {
  if (competitors.length === 0) return [];
  const gaps: BenchmarkGap[] = [];

  for (const category of VISIBILITY_CATEGORIES) {
    const key = visibilityCategoryScoreKey(category);
    const yours = yourScores[key];

    let best = -1;
    let bestLabel = "";
    let sum = 0;
    for (const c of competitors) {
      const v = c.scores[key];
      sum += v;
      if (v > best) {
        best = v;
        bestLabel = c.label;
      }
    }
    const average = round(sum / competitors.length);
    const gap = best - yours;
    if (gap <= 0) continue; // competitors don't beat you in this category

    gaps.push({
      category,
      categoryLabel: VISIBILITY_CATEGORY_LABELS[category],
      yourScore: yours,
      competitorBest: best,
      competitorBestLabel: bestLabel,
      competitorAverage: average,
      gap,
      estimatedPointGain: overallGainFromCategory(category, gap),
    });
  }

  // Biggest category gap first; tie-break by larger estimated overall gain.
  return gaps.sort(
    (a, b) => b.gap - a.gap || b.estimatedPointGain - a.estimatedPointGain,
  );
}

export function computeBenchmark(
  your: { websiteUrl: string; scores: VisibilityScores },
  competitors: CompetitorWithScan[],
): BenchmarkSummary {
  const scored = scoredCompetitors(competitors);
  const yourScore = your.scores.visibility_score;
  const overallList = scored.map((c) => c.scores.visibility_score);

  const competitorAverage =
    scored.length > 0
      ? round(overallList.reduce((s, v) => s + v, 0) / scored.length)
      : null;

  let best: BenchmarkSummary["best"] = null;
  let worst: BenchmarkSummary["worst"] = null;
  for (const c of scored) {
    const score = c.scores.visibility_score;
    if (!best || score > best.score) {
      best = { websiteUrl: c.websiteUrl, label: c.label, score };
    }
    if (!worst || score < worst.score) {
      worst = { websiteUrl: c.websiteUrl, label: c.label, score };
    }
  }

  // Standard competition ranking: 1 + number of competitors strictly above you.
  const aboveYou = overallList.filter((s) => s > yourScore).length;
  const yourRank = scored.length > 0 ? aboveYou + 1 : null;
  const fieldSize = scored.length + 1;

  const leaderScore = best ? best.score : yourScore;
  const gapToLeader = Math.max(0, leaderScore - yourScore);

  return {
    yourScore,
    competitorAverage,
    best,
    worst,
    yourRank,
    fieldSize,
    gapToLeader,
    scoredCompetitorCount: scored.length,
    topGaps: computeTopGaps(your.scores, scored),
  };
}
