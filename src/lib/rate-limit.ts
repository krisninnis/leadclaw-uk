import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

// Keep backward compatibility with existing code that uses the old rateLimit function
export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
