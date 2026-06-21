import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/lead-ops/board/route";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedCreateAdminClient = jest.mocked(createAdminClient);

function adminOk() {
  mockedRequireAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@leadclaw.uk" },
  });
}

type Captured = {
  leadsOrder: unknown[];
  leadsLimit: unknown[];
};

// Builds a chainable Supabase-style query builder that resolves to `result`.
// `record` captures the order/limit args used on the leads query so the test
// can lock the ordering/limit contract of the fix.
function makeBuilder(
  result: unknown,
  record?: { order: unknown[][]; limit: unknown[][] },
) {
  const builder: Record<string, unknown> = {};
  builder.select = jest.fn(() => builder);
  builder.in = jest.fn(() => builder);
  builder.order = jest.fn((...args: unknown[]) => {
    record?.order.push(args);
    return builder;
  });
  builder.limit = jest.fn((...args: unknown[]) => {
    record?.limit.push(args);
    return builder;
  });
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder;
}

function mockBoard(leads: unknown[]): Captured {
  const leadsRec = { order: [] as unknown[][], limit: [] as unknown[][] };

  mockedCreateAdminClient.mockReturnValue({
    from: jest.fn((table: string) => {
      if (table === "leads") {
        return makeBuilder({ data: leads, error: null }, leadsRec);
      }
      // outreach_events (and anything else read here)
      return makeBuilder({ data: [], error: null });
    }),
  } as unknown as ReturnType<typeof createAdminClient>);

  return {
    get leadsOrder() {
      return leadsRec.order[0] ?? [];
    },
    get leadsLimit() {
      return leadsRec.limit[0] ?? [];
    },
  } as Captured;
}

describe("GET /api/lead-ops/board", () => {
  beforeEach(() => jest.clearAllMocks());

  it("includes a stale status='new' scraper lead even when many rows have newer updated_at", async () => {
    adminOk();

    // One never-touched scraper lead: status 'new', oldest updated_at.
    const staleScraperLead = {
      id: "scraper_stale",
      company_name: "Old Scraper Co",
      contact_email: "owner@oldscraper.co.uk",
      city: "Leeds",
      status: "new",
      notes: null,
      updated_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    };

    // Many leads updated more recently than the scraper lead.
    const recentlyUpdated = Array.from({ length: 330 }, (_, i) => ({
      id: `recent_${i}`,
      company_name: `Recent ${i}`,
      contact_email: null,
      city: "London",
      status: "contacted",
      notes: null,
      updated_at: "2026-06-20T00:00:00.000Z",
      created_at: "2026-05-01T00:00:00.000Z",
    }));

    const captured = mockBoard([staleScraperLead, ...recentlyUpdated]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    // The stale scraper lead must be present in the Command Centre payload.
    const ids = body.leads.map((l: { id: string }) => l.id);
    expect(ids).toContain("scraper_stale");

    // Lock the fix: ordering is by created_at (lead arrival), not updated_at,
    // and the window cap is 500 (was 300).
    expect(captured.leadsOrder).toEqual(["created_at", { ascending: false }]);
    expect(captured.leadsLimit).toEqual([500]);
  });
});
