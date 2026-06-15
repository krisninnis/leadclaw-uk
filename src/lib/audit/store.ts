// Phase 2 — AI Website Audit (V1)
// Persistence helpers for website_audits. All writes go through the service-
// role admin client (RLS only grants users read access to their own rows).

import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditResult, WebsiteAuditRow } from "./types";

const TABLE = "website_audits";
const SELECT_COLS =
  "id,user_id,website_url,input_url,final_url,status,error,overall_score,health_score,seo_score,trust_score,conversion_score,ai_readiness_score,checks,recommendations,meta,engine_version,created_at,updated_at";

function admin() {
  const client = createAdminClient({ optional: true });
  return client as unknown as SupabaseUntypedClient | null;
}

export async function saveAudit(
  userId: string,
  result: AuditResult,
): Promise<WebsiteAuditRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(TABLE)
    .insert({
      user_id: userId,
      website_url: result.websiteUrl,
      input_url: result.inputUrl,
      final_url: result.finalUrl,
      status: result.status,
      error: result.error,
      overall_score: result.scores.overall_score,
      health_score: result.scores.health_score,
      seo_score: result.scores.seo_score,
      trust_score: result.scores.trust_score,
      conversion_score: result.scores.conversion_score,
      ai_readiness_score: result.scores.ai_readiness_score,
      checks: result.checks,
      recommendations: result.recommendations,
      meta: result.meta,
      engine_version: result.engineVersion,
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("[audit] failed to save audit", error);
    return null;
  }
  return data as unknown as WebsiteAuditRow;
}

export async function getLatestAudit(
  userId: string,
  websiteUrl?: string,
): Promise<WebsiteAuditRow | null> {
  const db = admin();
  if (!db) return null;

  let query = db.from(TABLE).select(SELECT_COLS).eq("user_id", userId);
  if (websiteUrl) query = query.eq("website_url", websiteUrl);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[audit] failed to load latest audit", error);
    return null;
  }
  return (data as unknown as WebsiteAuditRow) || null;
}

export async function getAuditById(
  userId: string,
  id: string,
): Promise<WebsiteAuditRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[audit] failed to load audit by id", error);
    return null;
  }
  return (data as unknown as WebsiteAuditRow) || null;
}

export async function getAuditHistory(
  userId: string,
  limit = 25,
): Promise<WebsiteAuditRow[]> {
  const db = admin();
  if (!db) return [];

  const { data, error } = await db
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[audit] failed to load audit history", error);
    return [];
  }
  return (data as unknown as WebsiteAuditRow[]) || [];
}
