import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isIP } from "node:net";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Admin routes — 20 requests per minute
export const adminRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
  prefix: "leadclaw:admin",
});

// Public widget routes — 60 requests per minute
export const widgetRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "leadclaw:widget",
});

// Outreach/retention runners — 10 requests per minute
export const runnerRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "leadclaw:runner",
});

// Website audit runs — 6 per minute per user (each run does several fetches).
export const auditRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, "1 m"),
  analytics: true,
  prefix: "leadclaw:audit",
});

// Public website audits are substantially more expensive than ordinary public
// widgets. Keep this deliberately tight and key it by client IP in the route.
export const publicAuditRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "10 m"),
  analytics: true,
  prefix: "leadclaw:public-audit",
});

// AI visibility scans — 10 per minute per user. Cheap (no crawl; derived from
// the existing audit), so a slightly higher allowance than audit runs.
export const visibilityRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "leadclaw:visibility",
});

// Landing page builder — admin CRUD. 30 per minute (form-driven, several
// saves per editing session).
export const landingAdminRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "leadclaw:landing-admin",
});

// Landing page first-party events (views/CTA clicks) — coarse public limiter.
export const landingEventRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "leadclaw:landing-event",
});

// Fail-open rate-limit wrapper: if Upstash is unreachable/unconfigured we
// allow the request rather than hard-failing the feature.
export async function checkRateLimit(
  limiter: Ratelimit,
  key: string,
): Promise<boolean> {
  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (err) {
    console.error("[rate-limit] limiter unavailable, failing open", err);
    return true;
  }
}

// Expensive unauthenticated routes must stop when the limiter is unavailable.
// Keep the existing fail-open helper for established routes whose availability
// policy is different; the public audit explicitly opts into this strict path.
export async function checkRateLimitStrict(
  limiter: Ratelimit,
  key: string,
): Promise<boolean> {
  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (err) {
    console.error("[rate-limit] limiter unavailable, failing closed", err);
    return false;
  }
}

function rightmostValidIp(value: string | null) {
  if (!value) return null;
  const candidates = value.split(",").map((candidate) => candidate.trim());
  for (let index = candidates.length - 1; index >= 0; index--) {
    if (isIP(candidates[index])) return candidates[index];
  }
  return null;
}

// Vercel keeps its platform-derived client address in
// x-vercel-forwarded-for even when another proxy overwrites X-Forwarded-For.
// For every list, choose the right-most valid hop rather than a spoofable
// left-most value supplied by the caller.
export function getPublicAuditClientIp(request: Request) {
  for (const header of [
    "x-vercel-forwarded-for",
    "x-forwarded-for",
    "x-real-ip",
  ]) {
    const address = rightmostValidIp(request.headers.get(header));
    if (address) return address;
  }
  return "unknown";
}

// Existing low-cost public routes retain their established extraction
// behaviour. The expensive audit route uses getPublicAuditClientIp above.
export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
