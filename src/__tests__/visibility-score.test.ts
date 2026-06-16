// Phase 3 — AI Visibility (Foundation)
// Unit tests for the pure scoring engine (no DB / no network).

import type { AuditChecksPayload, CheckResult } from "@/lib/audit/types";
import { calculateVisibilityScore } from "@/lib/visibility/score";
import { generateVisibilityRecommendations } from "@/lib/visibility/recommendations";
import { buildScanFromAudit } from "@/lib/visibility/run-scan";
import type { WebsiteAuditRow } from "@/lib/audit/types";

// Build a minimal AuditChecksPayload from a map of checkId -> score (0..1).
function checksFrom(scores: Record<string, number>): AuditChecksPayload {
  const mk = (id: string, score: number): CheckResult => ({
    id,
    label: id,
    category: "ai_readiness",
    score,
    weight: 1,
    passed: score >= 0.999,
    severity: "medium",
    detail: `detail for ${id}`,
  });
  return {
    categories: [
      {
        category: "ai_readiness",
        label: "AI Readiness",
        score: 0,
        checks: Object.entries(scores).map(([id, s]) => mk(id, s)),
      },
    ],
  };
}

// Every factor's source check, all passing.
const ALL_PASS: Record<string, number> = {
  knowledge_content: 1,
  treatment_pages: 1,
  faq_content: 1,
  structured_headings: 1,
  title_tag: 1,
  author_info: 1,
  review_content: 1,
  about: 1,
  contact_info: 1,
  sitemap: 1,
  robots: 1,
  internal_linking: 1,
  canonical: 1,
  https: 1,
  response_speed: 1,
  structured_data: 1,
  local_seo: 1,
};

describe("calculateVisibilityScore", () => {
  it("returns 100 across the board when every factor passes", () => {
    const { scores } = calculateVisibilityScore(checksFrom(ALL_PASS));
    expect(scores.visibility_score).toBe(100);
    expect(scores.content_score).toBe(100);
    expect(scores.authority_score).toBe(100);
    expect(scores.citation_score).toBe(100);
    expect(scores.schema_score).toBe(100);
  });

  it("returns 0 when no checks are present (nothing to score)", () => {
    const { scores, breakdown } = calculateVisibilityScore({ categories: [] });
    expect(scores.visibility_score).toBe(0);
    expect(breakdown.categories).toHaveLength(4);
  });

  it("lowers the schema score when FAQ, LocalBusiness and review schema are missing", () => {
    const weakSchema = {
      ...ALL_PASS,
      structured_data: 0,
      local_seo: 0,
      faq_content: 0,
      review_content: 0,
    };
    const { scores } = calculateVisibilityScore(checksFrom(weakSchema));
    expect(scores.schema_score).toBe(0);
    expect(scores.visibility_score).toBeLessThan(100);
  });

  it("lowers the authority score when author information is missing", () => {
    const noAuthor = { ...ALL_PASS, author_info: 0 };
    const full = calculateVisibilityScore(checksFrom(ALL_PASS)).scores.authority_score;
    const reduced = calculateVisibilityScore(checksFrom(noAuthor)).scores.authority_score;
    expect(reduced).toBeLessThan(full);
  });

  it("skips (does not zero) factors whose source check is absent", () => {
    // Only one content factor present and passing -> content should be 100,
    // not dragged down by the missing factors.
    const { scores } = calculateVisibilityScore(checksFrom({ faq_content: 1 }));
    expect(scores.content_score).toBe(100);
  });
});

describe("generateVisibilityRecommendations", () => {
  it("produces no recommendations when everything passes", () => {
    const { breakdown } = calculateVisibilityScore(checksFrom(ALL_PASS));
    expect(generateVisibilityRecommendations(breakdown)).toHaveLength(0);
  });

  it("ranks higher-severity, bigger-miss factors first", () => {
    const weak = { ...ALL_PASS, structured_data: 0, canonical: 0 };
    const { breakdown } = calculateVisibilityScore(checksFrom(weak));
    const recs = generateVisibilityRecommendations(breakdown);
    expect(recs.length).toBeGreaterThan(0);
    // structured_data is high severity -> should outrank low-severity canonical.
    expect(recs[0].id).toBe("structured_data");
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].priority).toBeGreaterThanOrEqual(recs[i].priority);
    }
  });
});

describe("buildScanFromAudit", () => {
  it("derives a completed ScanResult from an audit row", () => {
    const audit = {
      id: "audit-123",
      website_url: "https://example.co.uk",
      engine_version: "v1",
      created_at: "2026-06-15T10:00:00.000Z",
      checks: checksFrom(ALL_PASS),
    } as unknown as WebsiteAuditRow;

    const scan = buildScanFromAudit(audit);
    expect(scan.status).toBe("completed");
    expect(scan.websiteUrl).toBe("https://example.co.uk");
    expect(scan.scores.visibility_score).toBe(100);
    expect(scan.meta.sourceAuditId).toBe("audit-123");
    expect(scan.meta.auditedAt).toBe("2026-06-15T10:00:00.000Z");
    expect(scan.meta.providers).toEqual([]);
    expect(scan.meta.breakdown.categories).toHaveLength(4);
  });
});
