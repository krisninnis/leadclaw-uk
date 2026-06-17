import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/admin/outreach/activity/route";

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

// Chainable builder that records calls and resolves to { data, error }.
function mockActivities(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "limit", "eq"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: rows, error: null, count: null });

  mockedCreateAdminClient.mockReturnValue({
    from: jest.fn(() => builder),
  } as unknown as ReturnType<typeof createAdminClient>);

  return builder;
}

function makeRequest(query = "") {
  return new Request(
    `http://localhost/api/admin/outreach/activity${query}`,
  ) as unknown as Parameters<typeof GET>[0];
}

const sampleActivity = {
  id: "act_1",
  lead_id: "lead_1",
  action: "skipped",
  user_id: "admin-1",
  notes: null,
  metadata: {},
  created_at: "2026-06-17T09:00:00.000Z",
};

describe("GET /api/admin/outreach/activity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks non-admins with 403", async () => {
    adminForbidden();
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns activities for admins", async () => {
    adminOk();
    mockActivities([sampleActivity]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.activities).toEqual([sampleActivity]);
  });

  it("filters by lead_id when provided", async () => {
    adminOk();
    const builder = mockActivities([sampleActivity]);

    const res = await GET(makeRequest("?lead_id=lead_1"));
    await res.json();

    expect(builder.eq).toHaveBeenCalledWith("lead_id", "lead_1");
  });

  it("does not filter by lead_id when omitted", async () => {
    adminOk();
    const builder = mockActivities([sampleActivity]);

    await GET(makeRequest());

    expect(builder.eq).not.toHaveBeenCalled();
  });
});
