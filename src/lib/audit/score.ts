// Phase 2 — AI Website Audit (V1)
// Aggregate individual check results into category scores (0..100), an overall
// score, and a prioritised recommendation list.

import {
  AUDIT_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_WEIGHTS,
  categoryScoreKey,
  type AuditCategory,
  type AuditChecksPayload,
  type AuditScores,
  type CategoryResult,
  type CheckResult,
  type CheckSeverity,
  type Recommendation,
} from "./types";

function round(n: number) {
  return Math.round(n);
}

const SEVERITY_WEIGHT: Record<CheckSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// Weighted average of a category's checks, scaled to 0..100.
function scoreCategory(category: AuditCategory, checks: CheckResult[]): CategoryResult {
  const inCat = checks.filter((c) => c.category === category);
  const totalWeight = inCat.reduce((sum, c) => sum + c.weight, 0) || 1;
  const weighted = inCat.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = round((weighted / totalWeight) * 100);
  return {
    category,
    label: CATEGORY_LABELS[category],
    score,
    checks: inCat,
  };
}

export function buildScores(checks: CheckResult[]): {
  scores: AuditScores;
  checksPayload: AuditChecksPayload;
} {
  const categories = AUDIT_CATEGORIES.map((cat) => scoreCategory(cat, checks));

  const scores: AuditScores = {
    overall_score: 0,
    health_score: 0,
    seo_score: 0,
    trust_score: 0,
    conversion_score: 0,
    ai_readiness_score: 0,
  };

  let weightSum = 0;
  let weightedScore = 0;
  for (const cat of categories) {
    scores[categoryScoreKey(cat.category)] = cat.score;
    const w = CATEGORY_WEIGHTS[cat.category];
    weightSum += w;
    weightedScore += cat.score * w;
  }
  scores.overall_score = round(weightedScore / (weightSum || 1));

  return { scores, checksPayload: { categories } };
}

// Turn failed/partial checks into a prioritised action list. Priority blends
// severity with how far the check missed, so "almost there" high-severity items
// surface above trivial low-severity ones.
export function buildRecommendations(checks: CheckResult[]): Recommendation[] {
  return checks
    .filter((c) => c.score < 0.999 && c.recommendation)
    .map((c) => {
      const miss = 1 - c.score; // 0..1
      const priority = round(SEVERITY_WEIGHT[c.severity] * 10 + miss * 5);
      return {
        id: c.id,
        category: c.category,
        categoryLabel: CATEGORY_LABELS[c.category],
        severity: c.severity,
        title: c.label,
        detail: c.recommendation as string,
        priority,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}
