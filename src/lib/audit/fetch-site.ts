// Phase 2 — AI Website Audit (V1)
// Server-side, lightweight site fetching. No headless browser (no Playwright).
// We fetch the homepage HTML plus robots.txt and sitemap.xml with short
// timeouts, a clear LeadClaw user agent, and SSRF guards.

export const LEADCLAW_USER_AGENT =
  "LeadClawAuditBot/1.0 (+https://leadclaw.uk/audit)";

// Keep V1 fast and safe: short timeout, capped redirects, capped body size.
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 2_000_000; // 2 MB is plenty for signal parsing.

export type SiteFetchResult = {
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  redirected: boolean;
  html: string;
  bytes: number;
  responseMs: number;
  error: string | null;
};

export type AuxFetchResult = {
  found: boolean;
  status: number | null;
  body: string;
};

// ---- URL normalisation -------------------------------------------------

export class UrlValidationError extends Error {}

// Returns an https origin URL (scheme + host[:port]) with the path normalised.
// Throws UrlValidationError for anything we will not fetch.
export function normalizeAuditUrl(input: string): {
  origin: string;
  url: string;
} {
  const raw = String(input || "").trim();
  if (!raw) throw new UrlValidationError("Please enter a website URL.");

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new UrlValidationError("That does not look like a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlValidationError("Only http and https URLs are supported.");
  }

  // Always audit over https; we still record whether the original answered.
  parsed.protocol = "https:";
  parsed.hash = "";

  assertPublicHost(parsed.hostname);

  const origin = `${parsed.protocol}//${parsed.host}`;
  const path = parsed.pathname.replace(/\/+$/, "");
  return { origin, url: `${origin}${path}${parsed.search}` };
}

// Block obviously-internal targets to reduce SSRF risk. This is a pragmatic
// MVP guard (hostname/IP literal checks), not a full DNS-resolution defence —
// see the future-expansion notes for hardening with a resolver allowlist.
function assertPublicHost(hostname: string) {
  const host = hostname.toLowerCase();

  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    throw new UrlValidationError("Internal hosts cannot be audited.");
  }

  // IPv4 literal in a private / loopback / link-local range.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map((n) => parseInt(n, 10));
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0;
    if (isPrivate) {
      throw new UrlValidationError("Private IP addresses cannot be audited.");
    }
  }

  // IPv6 loopback / unique-local / link-local.
  if (host === "::1" || host.startsWith("[fc") || host.startsWith("[fd") || host.startsWith("[fe80")) {
    throw new UrlValidationError("Internal hosts cannot be audited.");
  }
}

// ---- Fetch helpers -----------------------------------------------------

async function timedFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": LEADCLAW_USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(init?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Read a capped amount of the response body so a huge page cannot exhaust
// memory on the serverless function.
async function readCapped(res: Response, cap: number): Promise<{ text: string; bytes: number }> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return { text, bytes: Buffer.byteLength(text) };
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      bytes += value.byteLength;
      chunks.push(value);
      if (bytes >= cap) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  }
  const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
  return { text, bytes };
}

// Fetch the main page. `redirect: follow` handles the redirect chain; we cap
// safety via the timeout and rely on fetch's own MAX redirect behaviour.
export async function fetchSite(url: string): Promise<SiteFetchResult> {
  const started = Date.now();
  try {
    const res = await timedFetch(url, { method: "GET" });
    const { text, bytes } = await readCapped(res, MAX_HTML_BYTES);
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      redirected: res.redirected || res.url !== url,
      html: text,
      bytes,
      responseMs: Date.now() - started,
      error: res.ok ? null : `Server responded with status ${res.status}.`,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: null,
      finalUrl: null,
      redirected: false,
      html: "",
      bytes: 0,
      responseMs: Date.now() - started,
      error: aborted
        ? "The site did not respond within the time limit."
        : "The site could not be reached.",
    };
  }
}

// Fetch an auxiliary text resource (robots.txt / sitemap.xml). Failures are
// non-fatal — they simply mean the signal is absent.
export async function fetchAux(origin: string, path: string): Promise<AuxFetchResult> {
  try {
    const res = await timedFetch(`${origin}${path}`, { method: "GET" });
    const { text } = await readCapped(res, 256_000);
    return { found: res.ok, status: res.status, body: res.ok ? text : "" };
  } catch {
    return { found: false, status: null, body: "" };
  }
}

export const FETCH_CONFIG = {
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_HTML_BYTES,
};
