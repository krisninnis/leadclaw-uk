// Phase 3 — AI Visibility (Foundation)
// generateVisibilityRecommendations(): turn weak factors into a prioritised,
// AI-visibility-framed action list. Priority blends severity with how far the
// factor missed, so "almost there" high-severity items surface first.

import {
  VISIBILITY_CATEGORY_LABELS,
  type VisibilityBreakdown,
  type VisibilityRecommendation,
  type VisibilitySeverity,
} from "./types";

const round = (n: number) => Math.round(n);

const SEVERITY_WEIGHT: Record<VisibilitySeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function generateVisibilityRecommendations(
  breakdown: VisibilityBreakdown,
): VisibilityRecommendation[] {
  const recs: VisibilityRecommendation[] = [];

  for (const cat of breakdown.categories) {
    for (const factor of cat.factors) {
      if (factor.score >= 0.999 || !factor.recommendation) continue;
      const miss = 1 - factor.score; // 0..1
      const priority = round(SEVERITY_WEIGHT[factor.severity] * 10 + miss * 5);
      recs.push({
        id: factor.id,
        category: factor.category,
        categoryLabel: VISIBILITY_CATEGORY_LABELS[factor.category],
        severity: factor.severity,
        title: factor.label,
        detail: factor.recommendation,
        priority,
      });
    }
  }

  return recs.sort((a, b) => b.priority - a.priority);
}
