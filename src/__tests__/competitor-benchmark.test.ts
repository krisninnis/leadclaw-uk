// AI Readiness — Competitor Benchmarking V1
// Unit tests for the pure benchmark maths and the competitor scan reuse path.
// No DB / no network — the underlying audit is mocked.

import type { AuditChecksPayload, CheckResult } from "@/lib/audit/types";
import type { VisibilityScores } from "@/lib/visibility/types";
import type {
  AiVisibilityCompetitorScanRow,
  CompetitorWithScan,
} from "@/lib/visibility/competitors-types";
import {
  computeBenchmark,
  computeTopGaps,
} from "@/lib/visibility/competitor-benchmark";

// Mock the audit engine so runCompetitorScan never touches the network.
jest.mock("@/lib/audit/run-audit", () => ({
  runAudit: jest.fn(),
  isUrlValidationError: () => false,
}));
import { runAudit } from "@/lib/audit/run-audit";
import {
  runCompetitorScan,
  benchmarkCompetitors,
} from "@/lib/visibility/competitors";

const mockRunAudit = runAudit as unknown as jest.Mock;

function scores(
  visibility: number,
  content: number,
  authority: number,
  citation: number,
  schema: number,
): VisibilityScores {
  return {
    visibility_score: visibility,
    content_score: content,
    authority_score: authority,
    citation_score: citation,
    schema_score: schema,
  };
}

function competitor(
  id: string,
  url: string,
  label: string | null,
  status: "completed" | "failed" | null,
  s?: VisibilityScores,
): CompetitorWithScan {
  const latestScan: AiVisibilityCompetitorScanRow | null =
    status === null
      ? null
      : ({
          id: `scan-${id}`,
          user_id: "u1",
          competitor_id: id,
          source_audit_id: null,
          website_url: url,
          status,
          error: status === "failed" ? "unreachable" : null,
          scores: s ?? scores(0, 0, 0, 0, 0),
          recommendations: [],
          meta: {} as never,
          created_at: "2026-06-20T10:00:00.000Z",
        } as AiVisibilityCompetitorScanRow);
  return {
    competitor: {
      id,
      user_id: "u1",
      website_url: url,
      label,
      created_at: "2026-06-19T10:00:00.000Z",
      updated_at: "2026-06-19T10:00:00.000Z",
    },
    latestScan,
  };
}

describe("computeBenchmark", () => {
  const you = { websiteUrl: "https://you.co.uk", scores: scores(70, 70, 70, 70, 70) };

  it("computes average, best, worst, rank and gap to leader", () => {
    const competitors = [
      competitor("a", "https://a.co.uk", "Alpha", "completed", scores(80, 90, 80, 70, 80)),
      competitor("b", "https://b.co.uk", "Beta", "completed", scores(60, 50, 60, 70, 60)),
    ];
    const b = computeBenchmark(you, competitors);

    expect(b.yourScore).toBe(70);
    expect(b.competitorAverage).toBe(70); // (80 + 60) / 2
    expect(b.best).toEqual({ websiteUrl: "https://a.co.uk", label: "Alpha", score: 80 });
    expect(b.worst).toEqual({ websiteUrl: "https://b.co.uk", label: "Beta", score: 60 });
    expect(b.scoredCompetitorCount).toBe(2);
    expect(b.fieldSize).toBe(3); // you + 2 scored
    expect(b.yourRank).toBe(2); // one competitor (80) is above you
    expect(b.gapToLeader).toBe(10); // 80 - 70
  });

  it("excludes failed and never-run competitors from scoring", () => {
    const competitors = [
      competitor("a", "https://a.co.uk", "Alpha", "completed", scores(90, 90, 90, 90, 90)),
      competitor("b", "https://b.co.uk", "Beta", "failed"),
      competitor("c", "https://c.co.uk", "Gamma", null),
    ];
    const b = computeBenchmark(you, competitors);

    expect(b.scoredCompetitorCount).toBe(1);
    expect(b.competitorAverage).toBe(90);
    expect(b.fieldSize).toBe(2);
    expect(b.yourRank).toBe(2);
  });

  it("reports you as leader (rank 1, gap 0) when you beat every competitor", () => {
    const competitors = [
      competitor("a", "https://a.co.uk", "Alpha", "completed", scores(40, 40, 40, 40, 40)),
    ];
    const b = computeBenchmark(you, competitors);
    expect(b.yourRank).toBe(1);
    expect(b.gapToLeader).toBe(0);
  });

  it("returns null aggregates and no gaps when there are no scored competitors", () => {
    const competitors = [competitor("b", "https://b.co.uk", "Beta", "failed")];
    const b = computeBenchmark(you, competitors);
    expect(b.competitorAverage).toBeNull();
    expect(b.best).toBeNull();
    expect(b.worst).toBeNull();
    expect(b.yourRank).toBeNull();
    expect(b.gapToLeader).toBe(0);
    expect(b.topGaps).toHaveLength(0);
  });

  it("falls back to the host when a competitor has no label", () => {
    const competitors = [
      competitor("a", "https://www.alpha.co.uk", null, "completed", scores(80, 80, 80, 80, 80)),
    ];
    const b = computeBenchmark(you, competitors);
    expect(b.best?.label).toBe("www.alpha.co.uk");
  });
});

describe("computeTopGaps", () => {
  it("only surfaces categories where a competitor beats you, biggest gap first", () => {
    const yours = scores(70, 60, 70, 90, 50);
    const gaps = computeTopGaps(yours, [
      { websiteUrl: "https://a.co.uk", label: "Alpha", scores: scores(80, 100, 60, 80, 90) },
    ]);
    // content gap = 40, schema gap = 40, authority/citation: competitor lower -> excluded.
    const categories = gaps.map((g) => g.category);
    expect(categories).toContain("content");
    expect(categories).toContain("schema");
    expect(categories).not.toContain("authority");
    expect(categories).not.toContain("citation");
    // sorted by gap descending
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].gap).toBeGreaterThanOrEqual(gaps[i].gap);
    }
  });

  it("estimates the overall-score gain as the category gap divided across 4 equal categories", () => {
    const yours = scores(70, 60, 70, 70, 70);
    const [gap] = computeTopGaps(yours, [
      { websiteUrl: "https://a.co.uk", label: "Alpha", scores: scores(70, 100, 70, 70, 70) },
    ]);
    expect(gap.category).toBe("content");
    expect(gap.gap).toBe(40);
    expect(gap.competitorBest).toBe(100);
    expect(gap.estimatedPointGain).toBe(10); // round(40 * 1/4)
  });
});

// ---- runCompetitorScan reuses the audit + readiness scoring pipeline ----

function checksFrom(map: Record<string, number>): AuditChecksPayload {
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
        checks: Object.entries(map).map(([id, s]) => mk(id, s)),
      },
    ],
  };
}

const ALL_PASS: Record<string, number> = {
  knowledge_content: 1, treatment_pages: 1, faq_content: 1, structured_headings: 1,
  title_tag: 1, author_info: 1, review_content: 1, about: 1, contact_info: 1,
  sitemap: 1, robots: 1, internal_linking: 1, canonical: 1, https: 1,
  response_speed: 1, structured_data: 1, local_seo: 1,
};

describe("runCompetitorScan", () => {
  beforeEach(() => mockRunAudit.mockReset());

  it("derives a completed readiness scan from a competitor audit", async () => {
    mockRunAudit.mockResolvedValue({
      websiteUrl: "https://rival.co.uk",
      status: "completed",
      error: null,
      checks: checksFrom(ALL_PASS),
      engineVersion: "v1",
      meta: { statusCode: 200 },
    });

    const result = await runCompetitorScan("rival.co.uk");
    expect(result.status).toBe("completed");
    expect(result.websiteUrl).toBe("https://rival.co.uk");
    expect(result.scores.visibility_score).toBe(100);
    expect(result.meta.sourceAuditId).toBeNull();
    expect(result.meta.auditStatusCode).toBe(200);
    expect(result.meta.breakdown.categories).toHaveLength(4);
  });

  it("returns a failed scan (not a throw) when the competitor site fails to load", async () => {
    mockRunAudit.mockResolvedValue({
      websiteUrl: "https://down.co.uk",
      status: "failed",
      error: "Homepage did not load",
      checks: { categories: [] },
      engineVersion: "v1",
      meta: { statusCode: 503 },
    });

    const result = await runCompetitorScan("down.co.uk");
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Homepage did not load");
    expect(result.scores.visibility_score).toBe(0);
  });

  it("never throws even if the audit engine throws", async () => {
    mockRunAudit.mockRejectedValue(new Error("network exploded"));
    const result = await runCompetitorScan("boom.co.uk");
    expect(result.status).toBe("failed");
    expect(result.scores.visibility_score).toBe(0);
  });
});

describe("benchmarkCompetitors", () => {
  beforeEach(() => mockRunAudit.mockReset());

  it("returns one fail-safe result per competitor, preserving order", async () => {
    mockRunAudit.mockImplementation(async (url: string) => ({
      websiteUrl: url.startsWith("http") ? url : `https://${url}`,
      status: url.includes("bad") ? "failed" : "completed",
      error: url.includes("bad") ? "nope" : null,
      checks: url.includes("bad") ? { categories: [] } : checksFrom(ALL_PASS),
      engineVersion: "v1",
      meta: { statusCode: url.includes("bad") ? 500 : 200 },
    }));

    const runs = await benchmarkCompetitors([
      { id: "1", website_url: "https://good1.co.uk" },
      { id: "2", website_url: "https://bad.co.uk" },
      { id: "3", website_url: "https://good2.co.uk" },
    ]);

    expect(runs.map((r) => r.competitorId)).toEqual(["1", "2", "3"]);
    expect(runs[0].result.status).toBe("completed");
    expect(runs[1].result.status).toBe("failed"); // one failure does not break the batch
    expect(runs[2].result.status).toBe("completed");
  });
});
