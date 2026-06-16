// Phase 3 — AI Visibility (Foundation)
// Core types + the scoring framework. Like the audit engine, the framework is
// declarative: each visibility category is a weighted list of "factors", and
// each factor reads a signal that already exists in a website_audits row. New
// factors can be added without touching the scoring maths or the DB schema.
//
// IMPORTANT: This phase derives visibility entirely from first-party audit
// data. It does NOT query ChatGPT, Perplexity, Google AI Overviews or Claude.
// Those are modelled as future providers (see providers.ts) and will enrich a
// scan via meta.providers later — no schema or scoring rewrite required.

export const VISIBILITY_ENGINE_VERSION = "v1";

export type VisibilityCategory =
  | "content"
  | "authority"
  | "citation"
  | "schema";

export const VISIBILITY_CATEGORIES: VisibilityCategory[] = [
  "content",
  "authority",
  "citation",
  "schema",
];

export const VISIBILITY_CATEGORY_LABELS: Record<VisibilityCategory, string> = {
  content: "Content",
  authority: "Authority",
  citation: "Citation",
  schema: "Schema",
};

export const VISIBILITY_CATEGORY_DESCRIPTIONS: Record<VisibilityCategory, string> = {
  content:
    "How clearly your content explains who you are and what you offer, in language AI assistants can summarise.",
  authority:
    "The expertise, reputation, and trust signals (E-E-A-T) AI systems weigh before recommending you.",
  citation:
    "How discoverable and crawlable your site is, so AI systems can find and cite it.",
  schema:
    "The structured data (JSON-LD) that lets machines read your business as facts, not prose.",
};

// Each category contributes equally to the overall visibility score in v1.
// Adjust here to re-weight without changing any factor logic.
export const VISIBILITY_CATEGORY_WEIGHTS: Record<VisibilityCategory, number> = {
  content: 1,
  authority: 1,
  citation: 1,
  schema: 1,
};

export type VisibilitySeverity = "high" | "medium" | "low";

// Result of a single factor after it reads the source audit.
export type VisibilityFactorResult = {
  id: string;
  label: string;
  category: VisibilityCategory;
  // 0..1 — partial credit allowed (mirrors the audit check score).
  score: number;
  // Relative importance of the factor inside its category.
  weight: number;
  severity: VisibilitySeverity;
  passed: boolean;
  // Short factual statement of what we found.
  detail: string;
  // Actionable, AI-visibility-framed fix shown when the factor is weak.
  recommendation?: string;
  // The audit check id this factor was derived from (provenance / debugging).
  sourceCheckId?: string;
};

export type VisibilityCategoryResult = {
  category: VisibilityCategory;
  label: string;
  description: string;
  score: number; // 0..100
  factors: VisibilityFactorResult[];
};

export type VisibilityRecommendation = {
  id: string;
  category: VisibilityCategory;
  categoryLabel: string;
  severity: VisibilitySeverity;
  title: string;
  detail: string;
  // Higher = do sooner. Blends severity with how far the factor missed.
  priority: number;
};

export type VisibilityScores = {
  visibility_score: number;
  content_score: number;
  authority_score: number;
  citation_score: number;
  schema_score: number;
};

// Persisted breakdown lives inside meta.factors so the detail view can render
// the per-category factors without an extra column.
export type VisibilityBreakdown = {
  categories: VisibilityCategoryResult[];
};

export type VisibilityMeta = {
  engineVersion: string;
  // The website_audits row this scan was derived from.
  sourceAuditId: string | null;
  sourceEngineVersion: string | null;
  // When the underlying audit was run (created_at of the source audit).
  auditedAt: string | null;
  // When this scan was computed.
  scannedAt: string;
  // Full per-category factor breakdown for the report view.
  breakdown: VisibilityBreakdown;
  // Future: per-provider visibility results. Empty until providers ship.
  providers: ProviderResult[];
  notes?: string[];
};

// Full result produced by runVisibilityScan(), ready to persist.
// This is the canonical ScanResult interface referenced by future providers.
export type ScanResult = {
  websiteUrl: string;
  status: "completed" | "failed";
  error: string | null;
  scores: VisibilityScores;
  recommendations: VisibilityRecommendation[];
  meta: VisibilityMeta;
};

// Row shape returned to the UI (subset of the DB row).
export type AiVisibilityScanRow = {
  id: string;
  user_id: string;
  website_url: string;
  status: string;
  error: string | null;
  visibility_score: number;
  content_score: number;
  authority_score: number;
  citation_score: number;
  schema_score: number;
  recommendations: VisibilityRecommendation[];
  meta: VisibilityMeta;
  created_at: string;
  updated_at: string;
};

export function visibilityCategoryScoreKey(
  category: VisibilityCategory,
): keyof VisibilityScores {
  switch (category) {
    case "content":
      return "content_score";
    case "authority":
      return "authority_score";
    case "citation":
      return "citation_score";
    case "schema":
      return "schema_score";
  }
}

// ---------------------------------------------------------------------------
// Phase 3D — future provider result shape (re-exported from providers.ts).
// Declared here as a type-only import target so ScanResult/VisibilityMeta can
// reference it without a runtime dependency cycle.
// ---------------------------------------------------------------------------
import type { ProviderResult } from "./providers";
export type { ProviderResult };
