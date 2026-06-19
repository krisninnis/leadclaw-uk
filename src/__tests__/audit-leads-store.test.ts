import { describe, expect, it, jest } from "@jest/globals";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveAuditLead } from "@/lib/audit/leads-store";
import {
  PUBLIC_AUDIT_CONSENT_TEXT,
  PUBLIC_AUDIT_CONSENT_VERSION,
} from "@/lib/audit/lead-consent";
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
  it("upserts one deduplicated lead with consent and reusable report context", async () => {
    const row = {
      id: "lead-1",
      created_at: "2026-06-19T12:00:00.000Z",
      name: "Alex Smith",
      email: "alex@example.com",
      website_url: "https://example.com",
      audit_score: 72,
      audit_summary:
        "Audit score 72/100. Top priorities: Add a clear booking action.",
      category_scores: {
        health: 80,
        seo: 70,
        trust: 75,
        conversion: 65,
        ai_readiness: 70,
      },
      top_recommendations: RESULT.recommendations,
      report_context: {
        status: "completed",
        recommendations: RESULT.recommendations,
      },
      consent: true,
      consent_text: PUBLIC_AUDIT_CONSENT_TEXT,
      consent_version: PUBLIC_AUDIT_CONSENT_VERSION,
      consent_captured_at: "2026-06-19T12:00:00.000Z",
      source: "free_audit",
    };
    const single = jest.fn(async () => ({ data: row, error: null }));
    const select = jest.fn().mockReturnValue({ single });
    const upsert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ upsert });
    mockedCreateAdminClient.mockReturnValue({ from } as never);

    await expect(
      saveAuditLead({
        name: "  Alex Smith  ",
        email: "  ALEX@EXAMPLE.COM  ",
        consent: true,
        result: RESULT,
      }),
    ).resolves.toEqual(row);

    expect(from).toHaveBeenCalledWith("audit_leads");
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      {
        name: "Alex Smith",
        email: "alex@example.com",
        website_url: "https://example.com",
        audit_score: 72,
        audit_summary:
          "Audit score 72/100. Top priorities: Add a clear booking action.",
        category_scores: {
          health: 80,
          seo: 70,
          trust: 75,
          conversion: 65,
          ai_readiness: 70,
        },
        top_recommendations: RESULT.recommendations,
        report_context: {
          websiteUrl: RESULT.websiteUrl,
          status: RESULT.status,
          error: RESULT.error,
          inputUrl: RESULT.inputUrl,
          finalUrl: RESULT.finalUrl,
          scores: RESULT.scores,
          checks: RESULT.checks,
          recommendations: RESULT.recommendations,
          meta: RESULT.meta,
          engineVersion: RESULT.engineVersion,
        },
        consent: true,
        consent_text: PUBLIC_AUDIT_CONSENT_TEXT,
        consent_version: PUBLIC_AUDIT_CONSENT_VERSION,
        consent_captured_at: expect.any(String),
        source: "free_audit",
      },
      { onConflict: "email,website_url" },
    );
  });
});
