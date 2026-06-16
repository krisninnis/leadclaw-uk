// Phase 3 — AI Visibility (Foundation)
// runVisibilityScan(): orchestrates a single scan. It reuses the user's most
// recent website_audits row (the Phase 2 crawl) rather than crawling again,
// computes the four visibility category scores, and builds recommendations.
//
// The pure transform (buildScanFromAudit) is separated from the DB load so it
// can be unit-tested without a database.

import { getLatestAudit } from "@/lib/audit/store";
import type { WebsiteAuditRow } from "@/lib/audit/types";
import { calculateVisibilityScore } from "./score";
import { generateVisibilityRecommendations } from "./recommendations";
import { VISIBILITY_ENGINE_VERSION, type ScanResult } from "./types";

// Raised when the user has no audit to derive a visibility scan from. The API
// layer maps this to a friendly "run an audit first" response.
export class NoAuditError extends Error {
  constructor(message = "No website audit found to derive visibility from.") {
    super(message);
    this.name = "NoAuditError";
  }
}

export const isNoAuditError = (e: unknown): e is NoAuditError =>
  e instanceof NoAuditError;

// Pure: derive a full ScanResult from an existing audit row.
export function buildScanFromAudit(audit: WebsiteAuditRow): ScanResult {
  const { scores, breakdown } = calculateVisibilityScore(audit.checks);
  const recommendations = generateVisibilityRecommendations(breakdown);

  return {
    websiteUrl: audit.website_url,
    // An audit that failed to load the site still yields a (low) scored result,
    // mirroring the audit engine's behaviour — surface it as completed.
    status: "completed",
    error: null,
    scores,
    recommendations,
    meta: {
      engineVersion: VISIBILITY_ENGINE_VERSION,
      sourceAuditId: audit.id,
      sourceEngineVersion: audit.engine_version ?? null,
      auditedAt: audit.created_at ?? null,
      scannedAt: new Date().toISOString(),
      breakdown,
      providers: [], // populated once real providers ship (Phase 3D+)
    },
  };
}

// Orchestrator: load the latest audit for the user (optionally for a specific
// website_url) and derive a visibility scan. Throws NoAuditError if none exist.
export async function runVisibilityScan(
  userId: string,
  websiteUrl?: string,
): Promise<ScanResult> {
  const audit = await getLatestAudit(userId, websiteUrl);
  if (!audit) {
    throw new NoAuditError();
  }
  return buildScanFromAudit(audit);
}
