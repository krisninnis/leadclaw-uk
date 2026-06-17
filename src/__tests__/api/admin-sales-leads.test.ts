import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/admin/sales/leads/route";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedCreateAdminClient = jest.mocked(createAdminClient);

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

function makeBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder;
}

function mockLeads(leads: unknown[], error: { message: string } | null = null) {
  const builder = makeBuilder({ data: leads, error });
  mockedCreateAdminClient.mockReturnValue({
    from: jest.fn(() => builder),
  } as unknown as ReturnType<typeof createAdminClient>);
  return builder;
}

function makeRequest(query = "") {
  return new Request(
    `http://localhost/api/admin/sales/leads${query}`,
  ) as unknown as Parameters<typeof GET>[0];
}

const sampleLead = {
  id: "lead_1",
  company_name: "Bright Plumbing Ltd",
  niche: "plumber",
  city: "London",
  lead_quality_score: 95,
  status: "new",
  contact_email: "owner@brightplumbing.co.uk",
  website: "https://brightplumbing.co.uk",
  created_at: "2026-06-14T09:00:00.000Z",
};

describe("GET /api/admin/sales/leads", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks non-admins with 403", async () => {
    adminForbidden();
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns leads for admins", async () => {
    adminOk();
    mockLeads([sampleLead]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0]).toMatchObject({
      id: "lead_1",
      company_name: "Bright Plumbing Ltd",
      niche: "plumber",
      city: "London",
      lead_quality_score: 95,
      status: "new",
      contact_email: "owner@brightplumbing.co.uk",
      website: "https://brightplumbing.co.uk",
    });
  });

  it("returns an empty list safely when there are no leads", async () => {
    adminOk();
    mockLeads([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.leads).toEqual([]);
  });

  it("surfaces a database error as a 500", async () => {
    adminOk();
    mockLeads([], { message: "boom" });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("boom");
  });
});
