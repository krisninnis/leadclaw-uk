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

// Pure: choose the origin to fetch /robots.txt and /sitemap.xml from. A homepage
// that redirects (apex -> www, or http -> https) serves those files on the FINAL
// host, so prefer the post-redirect origin and fall back to the entered one.
// Fixes "robots.txt/sitemap.xml missing" false positives caused by checking the
// pre-redirect origin.
export function deriveAuxOrigin(
  finalUrl: string | null,
  fallbackOrigin: string,
): string {
  if (!finalUrl) return fallbackOrigin;
  try {
    return new URL(finalUrl).origin;
  } catch {
    return fallbackOrigin;
  }
}

// Pure: same-origin sitemap paths declared via "Sitemap:" directives in
// robots.txt. Cross-origin directives are ignored (the aux fetcher is
// same-origin + SSRF-guarded). Deduped, order preserved, capped so a hostile
// robots.txt cannot fan out unbounded fetches. Standard locations are probed
// separately by the caller, so they are intentionally not included here.
export function declaredSitemapPaths(
  robotsBody: string,
  auxOrigin: string,
): string[] {
  let originHost: string | null = null;
  try {
    originHost = new URL(auxOrigin).host.toLowerCase();
  } catch {
    originHost = null;
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of (robotsBody || "").split(/\r?\n/)) {
    const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
    if (!m) continue;
    try {
      const u = new URL(m[1].trim(), auxOrigin);
      if (originHost && u.host.toLowerCase() !== originHost) continue;
      const p = `${u.pathname}${u.search}`;
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    } catch {
      // ignore malformed Sitemap: directive
    }
    if (out.length >= 5) break;
  }
  return out;
}

// Standard sitemap locations probed in parallel with robots.txt. Ordered
// most- to least-common so the usual case resolves on the first hit.
const STANDARD_SITEMAP_PATHS = ["/sitemap.xml", "/sitemap_index.xml"];

export async function runAudit(inputUrl: string): Promise<AuditResult> {
  // Throws UrlValidationError for bad/blocked URLs — caller maps to 400.
  const { origin, url } = normalizeAuditUrl(inputUrl);

  const site = await fetchSite(url);

  // Probe auxiliary files against the POST-redirect origin so an apex->www or
  // http->https redirect does not make a present robots.txt/sitemap look missing.
  const auxOrigin = deriveAuxOrigin(site.finalUrl, origin);

  // robots.txt + the two standard sitemap locations run in parallel (non-fatal
  // if missing). This keeps the common case at the original latency.
  const [robots, sm1, sm2] = await Promise.all([
    fetchAux(auxOrigin, "/robots.txt"),
    fetchAux(auxOrigin, STANDARD_SITEMAP_PATHS[0]),
    fetchAux(auxOrigin, STANDARD_SITEMAP_PATHS[1]),
  ]);

  // A sitemap is "present" if any standard location resolves, or any same-origin
  // path declared in robots.txt resolves. Declared paths are only probed when the
  // standard locations miss, and are capped, so worst-case fan-out stays bounded.
  let sitemapFound = sm1.found || sm2.found;
  if (!sitemapFound) {
    const declared = declaredSitemapPaths(robots.body, auxOrigin).filter(
      (p) => !STANDARD_SITEMAP_PATHS.includes(p),
    );
    for (const path of declared) {
      const probe = await fetchAux(auxOrigin, path);
      if (probe.found) {
        sitemapFound = true;
        break;
      }
    }
  }

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
    sitemapFound,
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
      sitemapFound,
      redirected: site.redirected,
    },
    engineVersion: AUDIT_ENGINE_VERSION,
  };
}

// Re-export for callers that only need the validator.
export { normalizeAuditUrl };
export const isUrlValidationError = (e: unknown): e is UrlValidationError =>
  e instanceof UrlValidationError;
