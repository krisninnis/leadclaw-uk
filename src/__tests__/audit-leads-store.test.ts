import { describe, expect, it, jest } from "@jest/globals";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAuditLead } from "@/lib/audit/leads-store";
import type { AuditResult } from "@/lib/audit/types";

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const mockedCreateAdminClient = jest.mocked(createAdminClient);

const RESULT: AuditResult = {
  websiteUrl: "https://example.com",
  inputUrl: "example.com",
  finalUrl: "https://example.com",
  status: "completed",
  error: null,
  scores: {
    overall_score: 72,
    health_score: 80,
    seo_score: 70,
    trust_score: 75,
    conversion_score: 65,
    ai_readiness_score: 70,
  },
  checks: { categories: [] },
  recommendations: [
    {
      id: "booking",
      category: "conversion",
      categoryLabel: "Conversion",
      severity: "high",
      title: "Add a clear booking action",
      detail: "Make the next step obvious.",
      priority: 15,
    },
  ],
  meta: {
    statusCode: 200,
    responseMs: 100,
    bytes: 1000,
    engine: "fetch",
    fetchedAt: "2026-06-19T12:00:00.000Z",
    robotsFound: true,
    sitemapFound: true,
    redirected: false,
  },
  engineVersion: "v1",
};

describe("saveAuditLead", () => {
  it("creates one isolated audit_leads row with the score and summary", async () => {
    const row = {
      id: "lead-1",
      created_at: "2026-06-19T12:00:00.000Z",
      name: "Alex Smith",
      email: "alex@example.com",
      website_url: "https://example.com",
      audit_score: 72,
      audit_summary:
        "Audit score 72/100. Top priorities: Add a clear booking action.",
      source: "free_audit",
    };
    const single = jest.fn(async () => ({ data: row, error: null }));
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });
    mockedCreateAdminClient.mockReturnValue({ from } as never);

    await expect(
      saveAuditLead({
        name: "  Alex Smith  ",
        email: "  ALEX@EXAMPLE.COM  ",
        result: RESULT,
      }),
    ).resolves.toEqual(row);

    expect(from).toHaveBeenCalledWith("audit_leads");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      name: "Alex Smith",
      email: "alex@example.com",
      website_url: "https://example.com",
      audit_score: 72,
      audit_summary:
        "Audit score 72/100. Top priorities: Add a clear booking action.",
      source: "free_audit",
    });
  });
});
