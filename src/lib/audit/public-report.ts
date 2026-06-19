import type {
  AuditCategory,
  AuditResult,
  CategoryResult,
  Recommendation,
} from "./types";

export type PublicCategoryScore = {
  category: AuditCategory;
  label: string;
  score: number;
};

export type PublicAuditReport = {
  websiteUrl: string;
  status: AuditResult["status"];
  error: string | null;
  overallScore: number;
  categoryScores: PublicCategoryScore[];
  topRecommendations: Recommendation[];
  fullReport: {
    recommendations: Recommendation[];
    categories: CategoryResult[];
  };
};

// Presentation mapping only. Scoring, checks, and recommendation ordering all
// remain owned by runAudit() and the existing audit engine.
export function buildPublicAuditReport(result: AuditResult): PublicAuditReport {
  const categories = result.checks.categories || [];
  return {
    websiteUrl: result.websiteUrl,
    status: result.status,
    error: result.error,
    overallScore: result.scores.overall_score,
    categoryScores: categories.map(({ category, label, score }) => ({
      category,
      label,
      score,
    })),
    topRecommendations: result.recommendations.slice(0, 5),
    fullReport: {
      recommendations: result.recommendations,
      categories,
    },
  };
}
