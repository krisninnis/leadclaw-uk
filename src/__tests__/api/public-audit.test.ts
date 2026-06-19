import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { POST } from "@/app/api/audit/public/route";
import { runAudit } from "@/lib/audit/run-audit";
import { saveAuditLead } from "@/lib/audit/leads-store";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AuditResult } from "@/lib/audit/types";

jest.mock("@/lib/audit/run-audit", () => ({
  runAudit: jest.fn(),
  isUrlValidationError: jest.fn(() => false),
}));
jest.mock("@/lib/audit/leads-store", () => ({ saveAuditLead: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  publicAuditRateLimit: {},
  checkRateLimit: jest.fn(),
  getClientIp: jest.fn(() => "203.0.113.10"),
}));

const mockedRunAudit = jest.mocked(runAudit);
const mockedSaveAuditLead = jest.mocked(saveAuditLead);
const mockedCheckRateLimit = jest.mocked(checkRateLimit);

const RESULT: AuditResult = {
  websiteUrl: "https://example.com",
  inputUrl: "example.com",
  finalUrl: "https://example.com",
  status: "completed",
  error: null,
  scores: {
    overall_score: 74,
    health_score: 80,
    seo_score: 70,
    trust_score: 75,
    conversion_score: 65,
    ai_readiness_score: 80,
  },
  checks: {
    categories: [
      { category: "health", label: "Website Health", score: 80, checks: [] },
    ],
  },
  recommendations: Array.from({ length: 6 }, (_, index) =>
    ({
      id: `recommendation-${index + 1}`,
      category: "conversion",
      categoryLabel: "Conversion",
      severity: "high",
      title: `Recommendation ${index + 1}`,
      detail: "Give visitors one obvious next step.",
      priority: 15 - index,
    }) as const,
  ),
  meta: {
    statusCode: 200,
    responseMs: 120,
    bytes: 3000,
    engine: "fetch",
    fetchedAt: "2026-06-19T12:00:00.000Z",
    robotsFound: true,
    sitemapFound: true,
    redirected: false,
  },
  engineVersion: "v1",
};

function request(body: object) {
  return new Request("http://localhost/api/audit/public", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/audit/public", () => {
  beforeEach(() => {
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedRunAudit.mockResolvedValue(RESULT);
    mockedSaveAuditLead.mockResolvedValue({
      id: "lead-1",
      created_at: "2026-06-19T12:00:00.000Z",
      name: "Alex Smith",
      email: "alex@example.com",
      website_url: RESULT.websiteUrl,
      audit_score: 74,
      audit_summary: "Audit score 74/100.",
      source: "free_audit",
    });
  });

  it("runs the shared engine, stores the lead once, then returns the full report", async () => {
    const response = await POST(
      request({
        websiteUrl: "example.com",
        name: "Alex Smith",
        email: "ALEX@EXAMPLE.COM",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedRunAudit).toHaveBeenCalledWith("example.com");
    expect(mockedSaveAuditLead).toHaveBeenCalledTimes(1);
    expect(mockedSaveAuditLead).toHaveBeenCalledWith({
      name: "Alex Smith",
      email: "alex@example.com",
      result: RESULT,
    });
    expect(body.report.overallScore).toBe(74);
    expect(body.report.topRecommendations).toHaveLength(5);
    expect(body.report.fullReport.recommendations).toHaveLength(6);
    expect(body.report.fullReport.categories).toHaveLength(1);
  });

  it("does not release a report when lead persistence fails", async () => {
    mockedSaveAuditLead.mockResolvedValue(null);

    const response = await POST(
      request({
        websiteUrl: "example.com",
        name: "Alex Smith",
        email: "alex@example.com",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, error: "lead_capture_failed" });
    expect(body.report).toBeUndefined();
  });

  it("requires all three lead fields before running an audit", async () => {
    const response = await POST(
      request({ websiteUrl: "example.com", name: "", email: "not-an-email" }),
    );

    expect(response.status).toBe(400);
    expect(mockedRunAudit).not.toHaveBeenCalled();
    expect(mockedSaveAuditLead).not.toHaveBeenCalled();
  });

  it("enforces the public per-IP rate limit", async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const response = await POST(
      request({
        websiteUrl: "example.com",
        name: "Alex Smith",
        email: "alex@example.com",
      }),
    );

    expect(response.status).toBe(429);
    expect(mockedRunAudit).not.toHaveBeenCalled();
  });
});
