// Phase 2 — AI Website Audit (V1)
// Core types + the scoring framework. Keeping the framework declarative
// (a list of weighted checks per category) means new checks can be added
// without touching the scoring maths or the storage schema.

export const AUDIT_ENGINE_VERSION = "v1";

export type AuditCategory =
  | "health"
  | "seo"
  | "trust"
  | "conversion"
  | "ai_readiness";

export const AUDIT_CATEGORIES: AuditCategory[] = [
  "health",
  "seo",
  "trust",
  "conversion",
  "ai_readiness",
];

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  health: "Website Health",
  seo: "SEO",
  trust: "Trust",
  conversion: "Conversion",
  ai_readiness: "AI Readiness",
};

// Each category contributes equally to the overall score in V1. Adjust here
// to re-weight overall without changing any check logic.
export const CATEGORY_WEIGHTS: Record<AuditCategory, number> = {
  health: 1,
  seo: 1,
  trust: 1,
  conversion: 1,
  ai_readiness: 1,
};

export type CheckSeverity = "high" | "medium" | "low";

// Concrete proof behind a finding, so the report shows evidence rather than a
// bare assertion. All fields optional — a check only sets what it can prove.
// This rides inside the existing `checks` jsonb column (no schema change).
export type CheckEvidence = {
  // A short verbatim excerpt we matched (e.g. the actual <title> text).
  snippet?: string;
  // The single concrete thing we found (e.g. a detected phone number).
  found?: string;
  // A count behind the finding (e.g. number of images missing alt text).
  count?: number;
  // A small sample of items (e.g. a few image srcs missing alt text).
  sample?: string[];
};

// Result of a single check after it runs against the crawled site.
export type CheckResult = {
  id: string;
  label: string;
  category: AuditCategory;
  // 0..1 — partial credit allowed (e.g. "some images missing alt").
  score: number;
  // Relative importance of the check inside its category.
  weight: number;
  passed: boolean;
  severity: CheckSeverity;
  // Short factual statement of what we found.
  detail: string;
  // Actionable fix shown when the check did not fully pass.
  recommendation?: string;
  // Optional concrete proof shown beneath the finding in the report.
  evidence?: CheckEvidence;
};

export type CategoryResult = {
  category: AuditCategory;
  label: string;
  score: number; // 0..100
  checks: CheckResult[];
};

export type Recommendation = {
  id: string;
  category: AuditCategory;
  categoryLabel: string;
  severity: CheckSeverity;
  title: string;
  detail: string;
  // Higher = do sooner. Derived from severity + how far the check missed.
  priority: number;
  // Concrete proof carried over from the originating check (optional).
  evidence?: CheckEvidence;
};

// Persisted shape of the `checks` jsonb column.
export type AuditChecksPayload = {
  categories: CategoryResult[];
};

export type AuditScores = {
  overall_score: number;
  health_score: number;
  seo_score: number;
  trust_score: number;
  conversion_score: number;
  ai_readiness_score: number;
};

export type AuditMeta = {
  statusCode: number | null;
  responseMs: number | null;
  bytes: number | null;
  engine: "fetch";
  fetchedAt: string;
  robotsFound: boolean;
  sitemapFound: boolean;
  redirected: boolean;
  notes?: string[];
};

// Full result produced by runAudit(), ready to persist.
export type AuditResult = {
  websiteUrl: string; // normalised origin
  inputUrl: string; // what the user typed
  finalUrl: string | null; // after redirects
  status: "completed" | "failed";
  error: string | null;
  scores: AuditScores;
  checks: AuditChecksPayload;
  recommendations: Recommendation[];
  meta: AuditMeta;
  engineVersion: string;
};

// Row shape returned to the UI (subset of the DB row).
export type WebsiteAuditRow = {
  id: string;
  user_id: string;
  website_url: string;
  input_url: string | null;
  final_url: string | null;
  status: string;
  error: string | null;
  overall_score: number;
  health_score: number;
  seo_score: number;
  trust_score: number;
  conversion_score: number;
  ai_readiness_score: number;
  checks: AuditChecksPayload;
  recommendations: Recommendation[];
  meta: AuditMeta;
  engine_version: string;
  created_at: string;
  updated_at: string;
};

export function categoryScoreKey(
  category: AuditCategory,
): keyof AuditScores {
  switch (category) {
    case "health":
      return "health_score";
    case "seo":
      return "seo_score";
    case "trust":
      return "trust_score";
    case "conversion":
      return "conversion_score";
    case "ai_readiness":
      return "ai_readiness_score";
  }
}
