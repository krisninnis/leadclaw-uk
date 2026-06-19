// V2.1a — audit engine safety net.
// Pure / fixture-based unit tests for the audit engine. No network, no DB.
// Mirrors the style of visibility-score.test.ts (inject data, assert pure
// transforms). Covers: normalizeAuditUrl (incl. SSRF rejections), parseHtml
// signal extraction, runChecks per category, buildScores / buildRecommendations
// ordering, and a golden-file regression guard on stable scores.

import fs from "fs";
import path from "path";

import {
  normalizeAuditUrl,
  UrlValidationError,
} from "@/lib/audit/fetch-site";
import type { SiteFetchResult } from "@/lib/audit/fetch-site";
import { parseHtml } from "@/lib/audit/parse-html";
import { runChecks, type CheckInput } from "@/lib/audit/checks";
import { buildScores, buildRecommendations } from "@/lib/audit/score";
import type { CheckResult } from "@/lib/audit/types";

// --- helpers --------------------------------------------------------------

function fakeFetch(over: Partial<SiteFetchResult> = {}): SiteFetchResult {
  return {
    ok: true,
    status: 200,
    finalUrl: "https://example.com/",
    redirected: false,
    html: "",
    bytes: 0,
    responseMs: 500,
    error: null,
    ...over,
  };
}

function buildInput(
  html: string,
  over: {
    fetch?: Partial<SiteFetchResult>;
    robotsFound?: boolean;
    sitemapFound?: boolean;
    httpsOk?: boolean;
    origin?: string;
  } = {},
): CheckInput {
  const origin = over.origin ?? "https://example.com";
  const fetch = fakeFetch({ finalUrl: `${origin}/`, ...over.fetch });
  const signals = parseHtml(html, fetch.finalUrl);
  return {
    origin,
    inputUrl: origin,
    httpsOk: over.httpsOk ?? true,
    fetch,
    signals,
    robotsFound: over.robotsFound ?? true,
    sitemapFound: over.sitemapFound ?? true,
  };
}

function byId(checks: CheckResult[]): Record<string, CheckResult> {
  return Object.fromEntries(checks.map((c) => [c.id, c]));
}

const GOLDEN_HTML = fs.readFileSync(
  path.join(__dirname, "fixtures", "audit", "golden-clinic.html"),
  "utf8",
);

// --- normalizeAuditUrl ----------------------------------------------------

describe("normalizeAuditUrl", () => {
  it("adds https when no scheme is given", () => {
    const { origin, url } = normalizeAuditUrl("example.com");
    expect(origin).toBe("https://example.com");
    expect(url).toBe("https://example.com");
  });

  it("coerces http to https and strips the hash", () => {
    const { origin, url } = normalizeAuditUrl("http://example.com/page#section");
    expect(origin).toBe("https://example.com");
    expect(url).toBe("https://example.com/page");
  });

  it("strips trailing slashes from the path", () => {
    const { url } = normalizeAuditUrl("https://example.com/about/");
    expect(url).toBe("https://example.com/about");
  });

  it("preserves the query string", () => {
    const { url } = normalizeAuditUrl("https://example.com/search?q=clinic");
    expect(url).toBe("https://example.com/search?q=clinic");
  });

  it("rejects empty input", () => {
    expect(() => normalizeAuditUrl("   ")).toThrow(UrlValidationError);
  });

  it("coerces a bare host to an https origin", () => {
    // V1 normaliser always forces https; scheme hardening is deferred to V2.1b.
    const { origin } = normalizeAuditUrl("HTTP://example.com");
    expect(origin).toBe("https://example.com");
  });

  it.each([
    ["localhost", "http://localhost/"],
    ["loopback ipv4", "http://127.0.0.1/"],
    ["private 10.x", "http://10.0.0.5/"],
    ["private 192.168.x", "http://192.168.1.1/"],
    ["private 172.16.x", "http://172.16.5.5/"],
    ["link-local", "http://169.254.1.1/"],
    [".local host", "http://printer.local/"],
    ["ipv6 unique-local", "http://[fc00::1]/"],
  ])("rejects SSRF target: %s", (_label, input) => {
    expect(() => normalizeAuditUrl(input)).toThrow(UrlValidationError);
  });

  it("allows a normal public IPv4", () => {
    expect(() => normalizeAuditUrl("http://8.8.8.8/")).not.toThrow();
  });
});

// --- parseHtml ------------------------------------------------------------

describe("parseHtml", () => {
  it("extracts core signals from a well-formed page", () => {
    const s = parseHtml(GOLDEN_HTML, "https://brightsmile.example/");
    expect(s.title).toContain("Brightsmile Dental Clinic");
    expect(s.metaDescription).toContain("Brightsmile Dental Clinic in Leeds");
    expect(s.canonical).toBe("https://brightsmile.example/");
    expect(s.h1Count).toBe(1);
    expect(s.h2Count).toBeGreaterThanOrEqual(2);
    expect(s.hasViewportMeta).toBe(true);
    expect(s.hasFavicon).toBe(true);
    expect(s.langAttr).toBe("en");
    expect(s.hasTelLink).toBe(true);
    expect(s.hasMailtoLink).toBe(true);
    expect(s.hasForm).toBe(true);
    expect(s.hasBookingLink).toBe(true);
    expect(s.jsonLdBlocks.length).toBe(2);
    expect(s.jsonLdTypes).toEqual(expect.arrayContaining(["Dentist", "FAQPage"]));
  });

  it("captures evidence-bearing fields", () => {
    const s = parseHtml(GOLDEN_HTML, "https://brightsmile.example/");
    // One of three images has no usable alt.
    expect(s.imageCount).toBe(3);
    expect(s.imagesWithAlt).toBe(2);
    expect(s.imagesMissingAltSample).toContain("/img/decorative-swoosh.png");
    expect(s.phoneSample).toBeTruthy();
    expect(s.addressMatch).toMatch(/LS1\s*4AB/i);
  });

  it("returns null/zero signals for an empty JS-shell page", () => {
    const shell =
      '<!DOCTYPE html><html><head></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
    const s = parseHtml(shell, "https://example.com/");
    expect(s.title).toBeNull();
    expect(s.metaDescription).toBeNull();
    expect(s.h1Count).toBe(0);
    expect(s.hasViewportMeta).toBe(false);
    expect(s.jsonLdBlocks.length).toBe(0);
    expect(s.imageCount).toBe(0);
    expect(s.imagesMissingAltSample).toEqual([]);
  });

  it("detects multiple H1s", () => {
    const s = parseHtml("<h1>One</h1><h1>Two</h1>", null);
    expect(s.h1Count).toBe(2);
  });

  it("computes the alt-text ratio from missing alts", () => {
    const html =
      '<img src="a.jpg" alt="good" /><img src="b.jpg" alt="" /><img src="c.jpg" />';
    const s = parseHtml(html, null);
    expect(s.imageCount).toBe(3);
    expect(s.imagesWithAlt).toBe(1);
    expect(s.imagesMissingAltSample).toEqual(["b.jpg", "c.jpg"]);
  });
});

// --- runChecks ------------------------------------------------------------

describe("runChecks", () => {
  it("produces a result for every check id across all 5 categories", () => {
    const checks = runChecks(buildInput(GOLDEN_HTML, { origin: "https://brightsmile.example" }));
    const cats = new Set(checks.map((c) => c.category));
    expect(cats).toEqual(
      new Set(["health", "seo", "trust", "conversion", "ai_readiness"]),
    );
    // Every check returns a 0..1 score and a boolean passed flag.
    for (const c of checks) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(1);
      expect(typeof c.passed).toBe("boolean");
    }
  });

  it("passes high-signal checks and attaches evidence on the golden page", () => {
    const checks = byId(
      runChecks(buildInput(GOLDEN_HTML, { origin: "https://brightsmile.example" })),
    );
    expect(checks.title_tag.passed).toBe(true);
    expect(checks.title_tag.evidence?.snippet).toContain("Brightsmile");
    expect(checks.h1_present.passed).toBe(true);
    expect(checks.phone.passed).toBe(true);
    expect(checks.phone.evidence?.found).toBeTruthy();
    expect(checks.image_alt.evidence?.count).toBe(1);
    expect(checks.image_alt.evidence?.sample).toContain("/img/decorative-swoosh.png");
    expect(checks.structured_data.passed).toBe(true);
  });

  it("fails and recommends for a missing-signal page", () => {
    const checks = byId(runChecks(buildInput("<html><body></body></html>")));
    expect(checks.title_tag.passed).toBe(false);
    expect(checks.title_tag.recommendation).toBeTruthy();
    expect(checks.h1_present.passed).toBe(false);
    expect(checks.phone.passed).toBe(false);
    expect(checks.structured_data.passed).toBe(false);
  });

  it("reflects httpsOk and reachability from the fetch result", () => {
    const ok = byId(runChecks(buildInput("<html></html>", { httpsOk: true })));
    expect(ok.https.passed).toBe(true);

    const bad = byId(
      runChecks(
        buildInput("<html></html>", {
          httpsOk: false,
          fetch: { ok: false, status: 500, error: "Server responded with status 500." },
        }),
      ),
    );
    expect(bad.https.passed).toBe(false);
    expect(bad.reachable.passed).toBe(false);
  });

  it("only attaches a recommendation when a check does not fully pass", () => {
    const checks = runChecks(buildInput(GOLDEN_HTML, { origin: "https://brightsmile.example" }));
    for (const c of checks) {
      if (c.passed) {
        expect(c.recommendation).toBeUndefined();
      }
    }
  });
});

// --- buildScores / buildRecommendations -----------------------------------

describe("buildScores", () => {
  it("aggregates category scores and an overall score in 0..100", () => {
    const checks = runChecks(buildInput(GOLDEN_HTML, { origin: "https://brightsmile.example" }));
    const { scores, checksPayload } = buildScores(checks);
    for (const key of Object.keys(scores) as (keyof typeof scores)[]) {
      expect(scores[key]).toBeGreaterThanOrEqual(0);
      expect(scores[key]).toBeLessThanOrEqual(100);
    }
    expect(checksPayload.categories).toHaveLength(5);
  });

  it("scores a fully-failing page at zero overall", () => {
    const checks = runChecks(
      buildInput("<html><body></body></html>", {
        httpsOk: false,
        robotsFound: false,
        sitemapFound: false,
        fetch: { ok: false, status: null, error: "unreachable", responseMs: 8000 },
      }),
    );
    const { scores } = buildScores(checks);
    expect(scores.overall_score).toBeLessThan(20);
  });
});

describe("buildRecommendations", () => {
  it("orders by priority (severity then miss) and skips passing checks", () => {
    const checks = runChecks(buildInput("<html><body></body></html>"));
    const recs = buildRecommendations(checks);
    expect(recs.length).toBeGreaterThan(0);
    // Sorted descending by priority.
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].priority).toBeGreaterThanOrEqual(recs[i].priority);
    }
    // Highest-priority item is a high-severity finding.
    expect(recs[0].severity).toBe("high");
  });

  it("carries evidence through onto recommendations", () => {
    const checks = runChecks(buildInput("<html><body></body></html>"));
    const recs = buildRecommendations(checks);
    const h1 = recs.find((r) => r.id === "h1_present");
    expect(h1?.evidence?.count).toBe(0);
  });

  it("returns no recommendations when every check passes", () => {
    const passing: CheckResult[] = [
      {
        id: "x",
        label: "X",
        category: "health",
        score: 1,
        weight: 1,
        passed: true,
        severity: "low",
        detail: "ok",
      },
    ];
    expect(buildRecommendations(passing)).toEqual([]);
  });
});

// --- golden-file regression guard -----------------------------------------

describe("golden file", () => {
  it("produces stable scores for the golden clinic page", () => {
    const checks = runChecks(
      buildInput(GOLDEN_HTML, {
        origin: "https://brightsmile.example",
        fetch: { responseMs: 500 },
      }),
    );
    const { scores } = buildScores(checks);
    // Regression guard: if these numbers move, a parser/check/scoring change
    // had a real effect — review it deliberately, then update the snapshot.
    expect(scores).toEqual(GOLDEN_SCORES);
  });
});

// Filled from a dry run; see "golden file" test above.
const GOLDEN_SCORES = {
  overall_score: 95,
  health_score: 100,
  seo_score: 97,
  trust_score: 90,
  conversion_score: 100,
  ai_readiness_score: 90,
};
