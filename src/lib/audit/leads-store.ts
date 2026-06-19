import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditResult } from "./types";
import {
  PUBLIC_AUDIT_CONSENT_TEXT,
  PUBLIC_AUDIT_CONSENT_VERSION,
} from "./lead-consent";

const TABLE = "audit_leads";
const SOURCE = "free_audit";

export type AuditLeadRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  website_url: string;
  audit_score: number;
  audit_summary: string;
  category_scores: Record<string, number>;
  top_recommendations: AuditResult["recommendations"];
  report_context: Record<string, unknown>;
  consent: boolean;
  consent_text: string | null;
  consent_version: string | null;
  consent_captured_at: string | null;
  source: string;
};

type SaveAuditLeadInput = {
  name: string;
  email: string;
  consent: true;
  result: AuditResult;
};

function buildAuditSummary(result: AuditResult) {
  const priorities = result.recommendations
    .slice(0, 3)
    .map((recommendation) => recommendation.title)
    .join("; ");

  if (result.status === "failed") {
    return `Audit score ${result.scores.overall_score}/100. The website could not be fully audited: ${result.error || "fetch failed"}.`;
  }

  return priorities
    ? `Audit score ${result.scores.overall_score}/100. Top priorities: ${priorities}.`
    : `Audit score ${result.scores.overall_score}/100. No outstanding recommendations.`;
}

export async function saveAuditLead({
  name,
  email,
  consent,
  result,
}: SaveAuditLeadInput): Promise<AuditLeadRow | null> {
  const admin = createAdminClient({ optional: true });
  if (!admin) {
    console.error("[public-audit] service-role client is unavailable");
    return null;
  }

  const capturedAt = new Date().toISOString();
  const categoryScores = {
    health: result.scores.health_score,
    seo: result.scores.seo_score,
    trust: result.scores.trust_score,
    conversion: result.scores.conversion_score,
    ai_readiness: result.scores.ai_readiness_score,
  };
  const reportContext = {
    websiteUrl: result.websiteUrl,
    status: result.status,
    error: result.error,
    inputUrl: result.inputUrl,
    finalUrl: result.finalUrl,
    scores: result.scores,
    checks: result.checks,
    recommendations: result.recommendations,
    meta: result.meta,
    engineVersion: result.engineVersion,
  };

  const { data, error } = await (admin as unknown as SupabaseUntypedClient)
    .from(TABLE)
    .upsert(
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        website_url: result.websiteUrl,
        audit_score: result.scores.overall_score,
        audit_summary: buildAuditSummary(result),
        category_scores: categoryScores,
        top_recommendations: result.recommendations.slice(0, 5),
        report_context: reportContext,
        consent,
        consent_text: PUBLIC_AUDIT_CONSENT_TEXT,
        consent_version: PUBLIC_AUDIT_CONSENT_VERSION,
        consent_captured_at: capturedAt,
        source: SOURCE,
      },
      { onConflict: "email,website_url" },
    )
    .select(
      "id,created_at,name,email,website_url,audit_score,audit_summary,category_scores,top_recommendations,report_context,consent,consent_text,consent_version,consent_captured_at,source",
    )
    .single();

  if (error) {
    console.error("[public-audit] failed to upsert lead", error);
    return null;
  }

  return data as unknown as AuditLeadRow;
}
