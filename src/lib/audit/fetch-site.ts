// Phase 2 — AI Website Audit (V1)
// Server-side, lightweight site fetching. No headless browser (no Playwright).
// Every outbound request is DNS-checked and every redirect is re-validated so
// the public audit endpoint cannot be used to reach private infrastructure.

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export const LEADCLAW_USER_AGENT =
  "LeadClawAuditBot/1.0 (+https://leadclaw.uk/audit)";

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 2_000_000;

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

export type AuditDnsLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

type AuditFetch = typeof fetch;

type FetchDependencies = {
  fetchImpl?: AuditFetch;
  lookup?: AuditDnsLookup;
};

export class UrlValidationError extends Error {}

const systemLookup: AuditDnsLookup = async (hostname, options) =>
  dnsLookup(hostname, options);

function unbracket(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== parts[index],
    )
  ) {
    return null;
  }
  return octets;
}

function isBlockedIpv4(address: string) {
  const octets = parseIpv4(address);
  if (!octets) return true;
  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function mappedIpv4(address: string): string | null {
  const lower = address.toLowerCase();
  if (!lower.startsWith("::ffff:")) return null;

  const tail = lower.slice("::ffff:".length);
  if (parseIpv4(tail)) return tail;

  const groups = tail.split(":");
  if (groups.length !== 2) return null;
  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null;
  }
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isBlockedIpv6(address: string) {
  const lower = unbracket(address);
  const mapped = mappedIpv4(lower);
  if (mapped) return isBlockedIpv4(mapped);

  return (
    lower === "::" ||
    lower === "::1" ||
    /^f[cd]/.test(lower) ||
    /^fe[89ab]/.test(lower) ||
    lower.startsWith("ff") ||
    lower.startsWith("2001:db8:")
  );
}

function assertPublicIp(address: string) {
  const ipVersion = isIP(unbracket(address));
  const blocked =
    ipVersion === 4
      ? isBlockedIpv4(unbracket(address))
      : ipVersion === 6
        ? isBlockedIpv6(unbracket(address))
        : true;

  if (blocked) {
    throw new UrlValidationError("Private IP addresses cannot be audited.");
  }
}

export function assertPublicHost(hostname: string) {
  const host = unbracket(hostname);
  const internalSuffixes = [
    ".local",
    ".internal",
    ".localhost",
    ".localdomain",
    ".lan",
    ".home",
    ".home.arpa",
    ".corp",
    ".intranet",
  ];

  if (
    !host ||
    host === "localhost" ||
    host === "0.0.0.0" ||
    (!host.includes(".") && isIP(host) === 0) ||
    internalSuffixes.some((suffix) => host.endsWith(suffix))
  ) {
    throw new UrlValidationError("Internal hosts cannot be audited.");
  }

  if (isIP(host)) assertPublicIp(host);
}

export async function assertPublicAuditTarget(
  target: string | URL,
  resolver: AuditDnsLookup = systemLookup,
) {
  const parsed = target instanceof URL ? target : new URL(target);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlValidationError("Only http and https URLs are supported.");
  }
  if (parsed.username || parsed.password) {
    throw new UrlValidationError("URLs containing credentials cannot be audited.");
  }

  const host = unbracket(parsed.hostname);
  assertPublicHost(host);
  if (isIP(host)) return;

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await resolver(host, { all: true, verbatim: true });
  } catch {
    throw new UrlValidationError("The website hostname could not be resolved.");
  }

  if (!addresses.length) {
    throw new UrlValidationError("The website hostname could not be resolved.");
  }
  for (const { address } of addresses) assertPublicIp(address);
}

// Returns an https origin URL (scheme + host[:port]) with the path normalised.
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
  if (parsed.username || parsed.password) {
    throw new UrlValidationError("URLs containing credentials cannot be audited.");
  }

  parsed.protocol = "https:";
  parsed.hash = "";
  assertPublicHost(parsed.hostname);

  const origin = `${parsed.protocol}//${parsed.host}`;
  const path = parsed.pathname.replace(/\/+$/, "");
  return { origin, url: `${origin}${path}${parsed.search}` };
}

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

async function timedFetch(
  url: string,
  init: RequestInit | undefined,
  dependencies: FetchDependencies,
): Promise<{ response: Response; finalUrl: string; redirected: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const resolver = dependencies.lookup ?? systemLookup;
  const headers = new Headers(init?.headers);
  headers.set("user-agent", LEADCLAW_USER_AGENT);
  if (!headers.has("accept")) {
    headers.set(
      "accept",
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    );
  }

  let currentUrl = url;
  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      await assertPublicAuditTarget(currentUrl, resolver);
      const response = await fetchImpl(currentUrl, {
        ...init,
        headers,
        signal: controller.signal,
        redirect: "manual",
      });

      const location = response.headers.get("location");
      if (!isRedirect(response.status) || !location) {
        return {
          response,
          finalUrl: currentUrl,
          redirected: redirectCount > 0,
        };
      }

      if (redirectCount === MAX_REDIRECTS) {
        throw new Error("Too many redirects.");
      }

      await response.body?.cancel().catch(() => {});
      currentUrl = new URL(location, currentUrl).toString();
    }
  } finally {
    clearTimeout(timer);
  }

  throw new Error("Too many redirects.");
}

async function readCapped(
  res: Response,
  cap: number,
): Promise<{ text: string; bytes: number }> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return { text, bytes: Buffer.byteLength(text) };
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
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
  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString(
    "utf8",
  );
  return { text, bytes };
}

export async function fetchSite(
  url: string,
  dependencies: FetchDependencies = {},
): Promise<SiteFetchResult> {
  const started = Date.now();
  try {
    const { response, finalUrl, redirected } = await timedFetch(
      url,
      { method: "GET" },
      dependencies,
    );
    const { text, bytes } = await readCapped(response, MAX_HTML_BYTES);
    return {
      ok: response.ok,
      status: response.status,
      finalUrl,
      redirected,
      html: text,
      bytes,
      responseMs: Date.now() - started,
      error: response.ok
        ? null
        : `Server responded with status ${response.status}.`,
    };
  } catch (err) {
    if (err instanceof UrlValidationError) throw err;
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

export async function fetchAux(
  origin: string,
  path: string,
  dependencies: FetchDependencies = {},
): Promise<AuxFetchResult> {
  try {
    const { response } = await timedFetch(
      `${origin}${path}`,
      { method: "GET" },
      dependencies,
    );
    const { text } = await readCapped(response, 256_000);
    return {
      found: response.ok,
      status: response.status,
      body: response.ok ? text : "",
    };
  } catch {
    return { found: false, status: null, body: "" };
  }
}

export const FETCH_CONFIG = {
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_HTML_BYTES,
};
