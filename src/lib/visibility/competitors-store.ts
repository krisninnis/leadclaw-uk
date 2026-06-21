// AI Readiness — Competitor Benchmarking V1
// Persistence helpers for ai_visibility_competitors + ai_visibility_competitor_scans.
// All writes go through the service-role admin client (RLS only grants users
// read access to their own rows), mirroring src/lib/visibility/store.ts.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_COMPETITORS,
  type AiVisibilityCompetitorRow,
  type AiVisibilityCompetitorScanRow,
  type CompetitorScanResult,
  type CompetitorWithScan,
} from "./competitors-types";

const COMPETITORS_TABLE = "ai_visibility_competitors";
const SCANS_TABLE = "ai_visibility_competitor_scans";
const COMPETITOR_COLS = "id,user_id,website_url,label,created_at,updated_at";
const SCAN_COLS =
  "id,user_id,competitor_id,source_audit_id,website_url,status,error,scores,recommendations,meta,created_at";

// Most recent scans to scan through when resolving "latest per competitor".
// With MAX_COMPETITORS competitors this comfortably covers many runs of history.
const RECENT_SCAN_LOOKBACK = 200;

function admin() {
  const client = createAdminClient({ optional: true });
  return client as unknown as SupabaseUntypedClient | null;
}

export async function listCompetitors(
  userId: string,
): Promise<AiVisibilityCompetitorRow[]> {
  const db = admin();
  if (!db) return [];

  const { data, error } = await db
    .from(COMPETITORS_TABLE)
    .select(COMPETITOR_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[competitors] failed to list competitors", error);
    return [];
  }
  return (data as unknown as AiVisibilityCompetitorRow[]) || [];
}

export async function getCompetitorById(
  userId: string,
  id: string,
): Promise<AiVisibilityCompetitorRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(COMPETITORS_TABLE)
    .select(COMPETITOR_COLS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[competitors] failed to load competitor", error);
    return null;
  }
  return (data as unknown as AiVisibilityCompetitorRow) || null;
}

export async function countCompetitors(userId: string): Promise<number> {
  const db = admin();
  if (!db) return 0;

  const { count, error } = await db
    .from(COMPETITORS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    console.error("[competitors] failed to count competitors", error);
    return 0;
  }
  return count ?? 0;
}

export type AddCompetitorOutcome =
  | { ok: true; competitor: AiVisibilityCompetitorRow }
  | { ok: false; error: "limit_reached" | "duplicate" | "unavailable" };

// Insert a competitor, enforcing the per-user cap and the unique-URL rule.
export async function addCompetitor(
  userId: string,
  websiteUrl: string,
  label: string | null,
): Promise<AddCompetitorOutcome> {
  const db = admin();
  if (!db) return { ok: false, error: "unavailable" };

  // Soft cap check. The unique index still guards duplicates; this guards count.
  const count = await countCompetitors(userId);
  if (count >= MAX_COMPETITORS) return { ok: false, error: "limit_reached" };

  const { data, error } = await db
    .from(COMPETITORS_TABLE)
    .insert({ user_id: userId, website_url: websiteUrl, label: label ?? null })
    .select(COMPETITOR_COLS)
    .single();

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (
      msg.includes("duplicate") ||
      msg.includes("unique") ||
      msg.includes("23505")
    ) {
      return { ok: false, error: "duplicate" };
    }
    console.error("[competitors] failed to add competitor", error);
    return { ok: false, error: "unavailable" };
  }
  return { ok: true, competitor: data as unknown as AiVisibilityCompetitorRow };
}

export async function deleteCompetitor(
  userId: string,
  id: string,
): Promise<boolean> {
  const db = admin();
  if (!db) return false;

  // Scans are removed by the ON DELETE CASCADE foreign key.
  const { error } = await db
    .from(COMPETITORS_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) {
    console.error("[competitors] failed to delete competitor", error);
    return false;
  }
  return true;
}

export async function saveCompetitorScan(
  userId: string,
  competitorId: string,
  result: CompetitorScanResult,
): Promise<AiVisibilityCompetitorScanRow | null> {
  const db = admin();
  if (!db) return null;

  const { data, error } = await db
    .from(SCANS_TABLE)
    .insert({
      user_id: userId,
      competitor_id: competitorId,
      source_audit_id: result.meta.sourceAuditId,
      website_url: result.websiteUrl,
      status: result.status,
      error: result.error,
      scores: result.scores,
      recommendations: result.recommendations,
      meta: result.meta,
    })
    .select(SCAN_COLS)
    .single();

  if (error) {
    console.error("[competitors] failed to save competitor scan", error);
    return null;
  }
  return data as unknown as AiVisibilityCompetitorScanRow;
}

// The most recent scan for each of the user's competitors, keyed by
// competitor_id. Reads a bounded recent window and keeps the newest per
// competitor (rows arrive newest-first), avoiding an N+1 per-competitor query.
export async function getLatestScansByCompetitor(
  userId: string,
): Promise<Map<string, AiVisibilityCompetitorScanRow>> {
  const map = new Map<string, AiVisibilityCompetitorScanRow>();
  const db = admin();
  if (!db) return map;

  const { data, error } = await db
    .from(SCANS_TABLE)
    .select(SCAN_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(RECENT_SCAN_LOOKBACK);

  if (error) {
    console.error("[competitors] failed to load competitor scans", error);
    return map;
  }

  for (const row of (data as unknown as AiVisibilityCompetitorScanRow[]) || []) {
    if (!map.has(row.competitor_id)) map.set(row.competitor_id, row);
  }
  return map;
}

// Competitors joined with their most recent scan (null if never run).
export async function listCompetitorsWithLatestScans(
  userId: string,
): Promise<CompetitorWithScan[]> {
  const [competitors, latest] = await Promise.all([
    listCompetitors(userId),
    getLatestScansByCompetitor(userId),
  ]);
  return competitors.map((competitor) => ({
    competitor,
    latestScan: latest.get(competitor.id) ?? null,
  }));
}
