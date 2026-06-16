// Phase 3 — AI Visibility (Foundation)
// calculateVisibilityScore(): turn a website_audit's check results into the
// four visibility category scores (content, authority, citation, schema) and
// an overall visibility score. Pure (no DB / no network) so it is trivially
// unit-testable.

import type { AuditChecksPayload, CheckResult } from "@/lib/audit/types";
import { VISIBILITY_FACTORS } from "./factors";
import {
  VISIBILITY_CATEGORIES,
  VISIBILITY_CATEGORY_DESCRIPTIONS,
  VISIBILITY_CATEGORY_LABELS,
  VISIBILITY_CATEGORY_WEIGHTS,
  visibilityCategoryScoreKey,
  type VisibilityBreakdown,
  type VisibilityCategory,
  type VisibilityCategoryResult,
  type VisibilityFactorResult,
  type VisibilityScores,
} from "./types";

const round = (n: number) => Math.round(n);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// Flatten the audit's per-category checks into a lookup by check id.
export function indexAuditChecks(
  checks: AuditChecksPayload | null | undefined,
): Map<string, CheckResult> {
  const map = new Map<string, CheckResult>();
  for (const cat of checks?.categories || []) {
    for (const c of cat.checks || []) {
      map.set(c.id, c);
    }
  }
  return map;
}

// Build the factor results for one category from the audit check lookup.
// Factors whose source check is absent (e.g. an older audit engine) are
// skipped rather than scored 0, so we never penalise for engine drift.
function buildCategoryFactors(
  category: VisibilityCategory,
  checkIndex: Map<string, CheckResult>,
): VisibilityFactorResult[] {
  return VISIBILITY_FACTORS.filter((f) => f.category === category)
    .map((f): VisibilityFactorResult | null => {
      const src = checkIndex.get(f.sourceCheckId);
      if (!src) return null;
      const score = clamp01(src.score);
      const passed = score >= 0.999;
      return {
        id: f.id,
        label: f.label,
        category: f.category,
        score,
        weight: f.weight,
        severity: f.severity,
        passed,
        detail: src.detail,
        recommendation: passed ? undefined : f.recommendation,
        sourceCheckId: f.sourceCheckId,
      };
    })
    .filter((x): x is VisibilityFactorResult => x !== null);
}

function scoreCategory(
  category: VisibilityCategory,
  factors: VisibilityFactorResult[],
): VisibilityCategoryResult {
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0) || 1;
  const weighted = factors.reduce((s, f) => s + f.score * f.weight, 0);
  const score = round((weighted / totalWeight) * 100);
  return {
    category,
    label: VISIBILITY_CATEGORY_LABELS[category],
    description: VISIBILITY_CATEGORY_DESCRIPTIONS[category],
    score,
    factors,
  };
}

export function calculateVisibilityScore(
  checks: AuditChecksPayload | null | undefined,
): { scores: VisibilityScores; breakdown: VisibilityBreakdown } {
  const checkIndex = indexAuditChecks(checks);

  const categories = VISIBILITY_CATEGORIES.map((cat) =>
    scoreCategory(cat, buildCategoryFactors(cat, checkIndex)),
  );

  const scores: VisibilityScores = {
    visibility_score: 0,
    content_score: 0,
    authority_score: 0,
    citation_score: 0,
    schema_score: 0,
  };

  let weightSum = 0;
  let weightedScore = 0;
  for (const cat of categories) {
    scores[visibilityCategoryScoreKey(cat.category)] = cat.score;
    const w = VISIBILITY_CATEGORY_WEIGHTS[cat.category];
    weightSum += w;
    weightedScore += cat.score * w;
  }
  scores.visibility_score = round(weightedScore / (weightSum || 1));

  return { scores, breakdown: { categories } };
}
