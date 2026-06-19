// Phase 3 — AI Visibility (Foundation)
// Persistence helpers for ai_visibility_scans. All writes go through the
// service-role admin client (RLS only grants users read access to their own
// rows), mirroring src/lib/audit/store.ts.

import { createAdminClient } from "@/lib/supabase/admin";
import type { AiVisibilityScanRow, ScanResult } from "./types";

const TABLE = "ai_visibility_scans";
const SELECT_COLS =
  "id,user_id,website_url,status,error,visibility_score,content_score,authority_score,citation_score,schema_score,recommendations,meta,created_at,updated_at";

function admin() {
  const client = createAdminClient({ optional: true });
  return client as unknown as SupabaseUntypedClient | null;
}

export async function saveScan(
  userId: string,
  result: ScanResult,
): Promise<AiVisibilityScanRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(TABLE)
    .insert({
      user_id: userId,
      website_url: result.websiteUrl,
      status: result.status,
      error: result.error,
      visibility_score: result.scores.visibility_score,
      content_score: result.scores.content_score,
      authority_score: result.scores.authority_score,
      citation_score: result.scores.citation_score,
      schema_score: result.scores.schema_score,
      recommendations: result.recommendations,
      meta: result.meta,
    })
    .select(SELECT_COLS)
    .single();

  if (error) {
    console.error("[visibility] failed to save scan", error);
    return null;
  }
  return data as unknown as AiVisibilityScanRow;
}

export async function getLatestScan(
  userId: string,
  websiteUrl?: string,
): Promise<AiVisibilityScanRow | null> {
  const db = admin();
  if (!db) return null;

  let query = db.from(TABLE).select(SELECT_COLS).eq("user_id", userId);
  if (websiteUrl) query = query.eq("website_url", websiteUrl);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[visibility] failed to load latest scan", error);
    return null;
  }
  return (data as unknown as AiVisibilityScanRow) || null;
}

export async function getScanById(
  userId: string,
  id: string,
): Promise<AiVisibilityScanRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[visibility] failed to load scan by id", error);
    return null;
  }
  return (data as unknown as AiVisibilityScanRow) || null;
}

// Pure: decide whether an already-persisted scan can be reused instead of
// inserting a new row. We reuse when an existing scan was derived from the same
// source audit — that audit hasn't changed, so the readiness result is
// identical and a new history entry would just be a duplicate. Extracted as a
// pure function so the dedup rule is deterministically unit-testable.
export function canReuseScan(
  existing: AiVisibilityScanRow | null,
  result: ScanResult,
): boolean {
  const sourceAuditId = result.meta?.sourceAuditId;
  if (!existing || !sourceAuditId) return false;
  return existing.meta?.sourceAuditId === sourceAuditId;
}

// Find the most recent scan derived from a specific source audit, if any.
export async function getScanBySourceAuditId(
  userId: string,
  sourceAuditId: string,
): Promise<AiVisibilityScanRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .eq("meta->>sourceAuditId", sourceAuditId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[visibility] failed to look up scan by source audit", error);
    return null;
  }
  return (data as unknown as AiVisibilityScanRow) || null;
}

// Persist a scan at most once per source audit: if a scan already exists for
// the same sourceAuditId, return it (reused: true) instead of inserting a
// duplicate history entry. Otherwise insert a new row (reused: false).
export async function persistScanOnce(
  userId: string,
  result: ScanResult,
): Promise<{ scan: AiVisibilityScanRow | null; reused: boolean }> {
  const sourceAuditId = result.meta?.sourceAuditId;
  if (sourceAuditId) {
    const existing = await getScanBySourceAuditId(userId, sourceAuditId);
    if (canReuseScan(existing, result)) {
      return { scan: existing, reused: true };
    }
  }
  const scan = await saveScan(userId, result);
  return { scan, reused: false };
}

export async function getScanHistory(
  userId: string,
  limit = 25,
): Promise<AiVisibilityScanRow[]> {
  const db = admin();
  if (!db) return [];

  const { data, error } = await db
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[visibility] failed to load scan history", error);
    return [];
  }
  return (data as unknown as AiVisibilityScanRow[]) || [];
}
