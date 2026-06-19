import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditResult } from "./types";

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
  source: string;
};

type SaveAuditLeadInput = {
  name: string;
  email: string;
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
  result,
}: SaveAuditLeadInput): Promise<AuditLeadRow | null> {
  const admin = createAdminClient({ optional: true });
  if (!admin) {
    console.error("[public-audit] service-role client is unavailable");
    return null;
  }

  const { data, error } = await (admin as unknown as SupabaseUntypedClient)
    .from(TABLE)
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      website_url: result.websiteUrl,
      audit_score: result.scores.overall_score,
      audit_summary: buildAuditSummary(result),
      source: SOURCE,
    })
    .select(
      "id,created_at,name,email,website_url,audit_score,audit_summary,source",
    )
    .single();

  if (error) {
    console.error("[public-audit] failed to store lead", error);
    return null;
  }

  return data as unknown as AuditLeadRow;
}
