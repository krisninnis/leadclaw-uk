// Phase 2 — AI Website Audit (V1)
// Orchestrates a single audit run: normalise URL -> fetch homepage + robots +
// sitemap -> parse signals -> run checks -> score -> build recommendations.
// Pure (no DB) so it is easy to unit test; persistence lives in store.ts.

import {
  fetchSite,
  fetchAux,
  normalizeAuditUrl,
  UrlValidationError,
} from "./fetch-site";
import { parseHtml } from "./parse-html";
import { runChecks, type CheckInput } from "./checks";
import { buildScores, buildRecommendations } from "./score";
import { AUDIT_ENGINE_VERSION, type AuditResult } from "./types";

export async function runAudit(inputUrl: string): Promise<AuditResult> {
  // Throws UrlValidationError for bad/blocked URLs — caller maps to 400.
  const { origin, url } = normalizeAuditUrl(inputUrl);

  const site = await fetchSite(url);

  // Auxiliary signals run in parallel; non-fatal if missing.
  const [robots, sitemap] = await Promise.all([
    fetchAux(origin, "/robots.txt"),
    fetchAux(origin, "/sitemap.xml"),
  ]);

  // If the homepage itself failed, still produce a (low) scored result so the
  // user sees actionable feedback rather than an opaque error.
  const signals = parseHtml(site.html || "", site.finalUrl);

  const checkInput: CheckInput = {
    origin,
    inputUrl,
    httpsOk: site.ok && (site.finalUrl ?? url).startsWith("https://"),
    fetch: site,
    signals,
    robotsFound: robots.found,
    sitemapFound: sitemap.found,
  };

  const checks = runChecks(checkInput);
  const { scores, checksPayload } = buildScores(checks);
  const recommendations = buildRecommendations(checks);

  return {
    websiteUrl: origin,
    inputUrl,
    finalUrl: site.finalUrl,
    status: site.ok ? "completed" : "failed",
    error: site.ok ? null : site.error,
    scores,
    checks: checksPayload,
    recommendations,
    meta: {
      statusCode: site.status,
      responseMs: site.responseMs,
      bytes: site.bytes,
      engine: "fetch",
      fetchedAt: new Date().toISOString(),
      robotsFound: robots.found,
      sitemapFound: sitemap.found,
      redirected: site.redirected,
    },
    engineVersion: AUDIT_ENGINE_VERSION,
  };
}

// Re-export for callers that only need the validator.
export { normalizeAuditUrl };
export const isUrlValidationError = (e: unknown): e is UrlValidationError =>
  e instanceof UrlValidationError;
