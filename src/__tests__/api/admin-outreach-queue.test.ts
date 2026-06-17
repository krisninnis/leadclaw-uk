import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/outreach-templates", () => {
  const actual = jest.requireActual("@/lib/outreach-templates") as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    listOutreachTemplates: jest.fn(),
  };
});

import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listOutreachTemplates } from "@/lib/outreach-templates";
import { GET } from "@/app/api/admin/outreach/queue/route";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedCreateAdminClient = jest.mocked(createAdminClient);
const mockedListTemplates = jest.mocked(listOutreachTemplates);

function adminOk() {
  mockedRequireAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@leadclaw.uk" },
  });
}

function adminForbidden() {
  mockedRequireAdmin.mockResolvedValue({
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    ),
  });
}

// Build a chainable Supabase query builder mock that resolves to { data, error }.
function makeBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit", "gte", "in"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder;
}

// Table-aware admin mock: `leads` returns the given leads, `outreach_queue`
// returns the given actioned queue rows (default: none).
function mockLeads(
  leads: unknown[],
  queueRows: Array<{ lead_id: string; status: string }> = [],
  error: { message: string } | null = null,
) {
  const leadsBuilder = makeBuilder({ data: leads, error, count: null });
  const queueBuilder = makeBuilder({
    data: queueRows,
    error: null,
    count: null,
  });

  mockedCreateAdminClient.mockReturnValue({
    from: jest.fn((table: string) =>
      table === "outreach_queue" ? queueBuilder : leadsBuilder,
    ),
  } as unknown as ReturnType<typeof createAdminClient>);

  return leadsBuilder;
}

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead_1",
    company_name: "Bright Plumbing Ltd",
    contact_email: "owner@brightplumbing.co.uk",
    contact_phone: "0123456789",
    website: "https://brightplumbing.co.uk",
    city: "London",
    niche: "plumber",
    lead_quality_score: 95,
    pecr_classification: "likely_corporate",
    status: "new",
    created_at: "2026-06-14T09:00:00.000Z",
    ...overrides,
  };
}

function makeRequest(query = "") {
  return new Request(
    `http://localhost/api/admin/outreach/queue${query}`,
  ) as unknown as Parameters<typeof GET>[0];
}

const activeTemplate = {
  id: "tpl-1",
  name: "Default Pitch",
  subject_template: "Quick idea for {{company_name}}",
  body_template: "Hi {{company_name}} team in {{city}}.",
  status: "active" as const,
};

describe("GET /api/admin/outreach/queue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedListTemplates.mockResolvedValue([activeTemplate]);
  });

  it("blocks non-admins with 403", async () => {
    adminForbidden();
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns an eligible lead for admins", async () => {
    adminOk();
    mockLeads([makeLead()]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.totalChecked).toBe(1);
    expect(body.totalEligible).toBe(1);
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0]).toMatchObject({
      id: "lead_1",
      contact_email: "owner@brightplumbing.co.uk",
      email_quality: "medium",
    });
  });

  it("excludes manual_review (non-corporate) leads by default", async () => {
    adminOk();
    mockLeads([makeLead({ pecr_classification: "manual_review" })]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.totalChecked).toBe(1);
    expect(body.totalEligible).toBe(0);
    expect(body.leads).toHaveLength(0);
  });

  it("excludes likely_sole_trader leads by default", async () => {
    adminOk();
    mockLeads([makeLead({ pecr_classification: "likely_sole_trader" })]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.totalEligible).toBe(0);
    expect(body.leads).toHaveLength(0);
  });

  it("excludes leads with a missing email by default", async () => {
    adminOk();
    mockLeads([makeLead({ contact_email: null })]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.totalEligible).toBe(0);
    expect(body.leads).toHaveLength(0);
  });

  it("includes ineligible leads with reasons when includeIneligible=true", async () => {
    adminOk();
    mockLeads([makeLead({ pecr_classification: "manual_review" })]);

    const res = await GET(makeRequest("?includeIneligible=true"));
    const body = await res.json();

    expect(body.totalChecked).toBe(1);
    expect(body.totalEligible).toBe(0);
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0].eligible).toBe(false);
    expect(body.leads[0].eligibility_reasons).toContain("not_likely_corporate");
  });

  it("generates a draft when an active template exists", async () => {
    adminOk();
    mockLeads([makeLead()]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.templateMissing).toBe(false);
    expect(body.leads[0].draft_subject).toBe("Quick idea for Bright Plumbing Ltd");
    expect(body.leads[0].draft_body).toBe("Hi Bright Plumbing Ltd team in London.");
  });

  it("works with null drafts and templateMissing when no active template exists", async () => {
    adminOk();
    mockedListTemplates.mockResolvedValue([
      { ...activeTemplate, status: "archived" as const },
    ]);
    mockLeads([makeLead()]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.templateMissing).toBe(true);
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0].draft_subject).toBeNull();
    expect(body.leads[0].draft_body).toBeNull();
  });

  it("hides leads already actioned in the queue by default", async () => {
    adminOk();
    mockLeads(
      [
        makeLead({ id: "lead_1" }),
        makeLead({ id: "lead_2", contact_email: "two@brightplumbing.co.uk" }),
      ],
      [{ lead_id: "lead_2", status: "skipped" }],
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.totalChecked).toBe(2);
    expect(body.totalEligible).toBe(1);
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0].id).toBe("lead_1");
  });

  it("annotates actioned leads with queue_status when includeIneligible=true", async () => {
    adminOk();
    mockLeads(
      [makeLead({ id: "lead_2" })],
      [{ lead_id: "lead_2", status: "do_not_contact" }],
    );

    const res = await GET(makeRequest("?includeIneligible=true"));
    const body = await res.json();

    expect(body.leads).toHaveLength(1);
    expect(body.leads[0].queue_status).toBe("do_not_contact");
    expect(body.leads[0].eligible).toBe(false);
    expect(body.leads[0].eligibility_reasons).toContain("queue_do_not_contact");
  });
});
