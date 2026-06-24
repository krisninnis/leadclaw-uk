import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/admin/pilot-recruitment/route";
import { POST } from "@/app/api/admin/pilot-recruitment/[leadId]/route";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedCreateAdminClient = jest.mocked(createAdminClient);

const LEAD_ID = "11111111-1111-1111-1111-111111111111";

type Captured = { table: string; method: string; args: unknown[] };

function adminOk() {
  mockedRequireAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@leadclaw.uk" },
  });
}

function adminForbidden() {
  mockedRequireAdmin.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
  });
}

// A flexible chainable Supabase mock. Each from(table) call returns a fresh
// thenable builder; awaiting the chain resolves to the next queued result for
// that table. Every method call is recorded in `captured` so tests can assert
// exactly which tables were written to.
function makeClient(tables: Record<string, unknown[]>) {
  const captured: Captured[] = [];
  const cursor: Record<string, number> = {};
  const client = {
    captured,
    from: jest.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      const methods = [
        "select",
        "order",
        "limit",
        "eq",
        "neq",
        "in",
        "is",
        "upsert",
        "insert",
        "update",
        "delete",
        "maybeSingle",
        "single",
      ];
      for (const m of methods) {
        builder[m] = jest.fn((...args: unknown[]) => {
          captured.push({ table, method: m, args });
          return builder;
        });
      }
      builder.then = (resolve: (v: unknown) => unknown) => {
        const idx = cursor[table] ?? 0;
        cursor[table] = idx + 1;
        const results = tables[table] || [];
        return resolve(results[idx] ?? { data: null, error: null });
      };
      return builder;
    }),
  };
  mockedCreateAdminClient.mockReturnValue(
    client as unknown as ReturnType<typeof createAdminClient>,
  );
  return client;
}

function getReq(query = "") {
  return new Request(
    `http://localhost/api/admin/pilot-recruitment${query}`,
  ) as unknown as Parameters<typeof GET>[0];
}

function postReq(body: unknown) {
  return new Request(`http://localhost/api/admin/pilot-recruitment/${LEAD_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function ctx() {
  return { params: Promise.resolve({ leadId: LEAD_ID }) };
}

const plumberLead = {
  id: LEAD_ID,
  company_name: "Bright Plumbing Ltd",
  niche: "plumber",
  city: "London",
  website: "https://brightplumbing.co.uk",
  contact_phone: "020 0000 0000",
  contact_email: "owner@brightplumbing.co.uk",
  status: "new",
  score: 40,
  lead_score: null,
  lead_quality_score: 95,
  has_live_chat: false,
  has_contact_form: false,
  created_at: "2026-06-14T09:00:00.000Z",
};

describe("GET /api/admin/pilot-recruitment", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks non-admins with 403", async () => {
    adminForbidden();
    const res = await GET(getReq());
    expect(res.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns ranked candidates and summary from existing leads", async () => {
    adminOk();
    makeClient({
      leads: [{ data: [plumberLead], error: null }],
      lead_pilot_recruitment: [{ data: [], error: null }],
    });

    const res = await GET(getReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0]).toMatchObject({
      leadId: LEAD_ID,
      trade: "plumber",
      pilotStatus: "candidate",
    });
    expect(body.summary.newCandidates).toBe(1);
    expect(body.pilotTableReady).toBe(true);
  });

  it("filters by trade", async () => {
    adminOk();
    makeClient({
      leads: [
        {
          data: [
            plumberLead,
            { ...plumberLead, id: "22222222-2222-2222-2222-222222222222", niche: "roofer", company_name: "Peak Roofing" },
          ],
          error: null,
        },
      ],
      lead_pilot_recruitment: [{ data: [], error: null }],
    });

    const res = await GET(getReq("?trade=roofer"));
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].trade).toBe("roofer");
  });

  it("degrades gracefully when the pilot table is missing", async () => {
    adminOk();
    makeClient({
      leads: [{ data: [plumberLead], error: null }],
      lead_pilot_recruitment: [
        { data: null, error: { message: 'relation "lead_pilot_recruitment" does not exist' } },
      ],
    });

    const res = await GET(getReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.pilotTableReady).toBe(false);
    expect(body.candidates).toHaveLength(1);
  });
});

describe("POST /api/admin/pilot-recruitment/[leadId]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks non-admins with 403", async () => {
    adminForbidden();
    const res = await POST(postReq({ pilot_status: "contacted" }), ctx());
    expect(res.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid pilot status", async () => {
    adminOk();
    makeClient({});
    const res = await POST(postReq({ pilot_status: "bogus" }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_pilot_status");
  });

  it("writes ONLY to lead_pilot_recruitment — never to the leads table", async () => {
    adminOk();
    const client = makeClient({
      leads: [{ data: { id: LEAD_ID }, error: null }],
      lead_pilot_recruitment: [
        { data: null, error: null },
        { data: { lead_id: LEAD_ID, pilot_status: "contacted", contacted_count: 1 }, error: null },
      ],
    });

    const res = await POST(postReq({ markContacted: true }), ctx());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    const writeMethods = new Set(["insert", "update", "upsert", "delete"]);
    const writes = client.captured.filter((c) => writeMethods.has(c.method));
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) expect(w.table).toBe("lead_pilot_recruitment");

    const readMethods = new Set(["select", "eq", "maybeSingle", "single", "order", "limit"]);
    const leadOps = client.captured.filter((c) => c.table === "leads");
    expect(leadOps.length).toBeGreaterThan(0);
    for (const op of leadOps) expect(readMethods.has(op.method)).toBe(true);
  });

  it("increments contacted_count and advances a new candidate to contacted", async () => {
    adminOk();
    const client = makeClient({
      leads: [{ data: { id: LEAD_ID }, error: null }],
      lead_pilot_recruitment: [
        { data: { lead_id: LEAD_ID, pilot_status: "candidate", contacted_count: 2 }, error: null },
        { data: { lead_id: LEAD_ID, pilot_status: "contacted", contacted_count: 3 }, error: null },
      ],
    });

    const res = await POST(postReq({ markContacted: true }), ctx());
    expect(res.status).toBe(200);

    const upsert = client.captured.find((c) => c.method === "upsert");
    const row = upsert?.args[0] as Record<string, unknown>;
    expect(row.contacted_count).toBe(3);
    expect(row.pilot_status).toBe("contacted");
    expect(typeof row.last_contacted_at).toBe("string");
  });

  it("stamps the interested milestone timestamp once", async () => {
    adminOk();
    const client = makeClient({
      leads: [{ data: { id: LEAD_ID }, error: null }],
      lead_pilot_recruitment: [
        { data: { lead_id: LEAD_ID, pilot_status: "contacted", interested_at: null }, error: null },
        { data: { lead_id: LEAD_ID, pilot_status: "interested" }, error: null },
      ],
    });

    const res = await POST(postReq({ pilot_status: "interested" }), ctx());
    expect(res.status).toBe(200);
    const upsert = client.captured.find((c) => c.method === "upsert");
    const row = upsert?.args[0] as Record<string, unknown>;
    expect(row.pilot_status).toBe("interested");
    expect(typeof row.interested_at).toBe("string");
  });

  it("rejects a non-UUID lead id", async () => {
    adminOk();
    makeClient({});
    const badCtx = { params: Promise.resolve({ leadId: "not-a-uuid" }) };
    const res = await POST(
      new Request("http://localhost/api/admin/pilot-recruitment/not-a-uuid", {
        method: "POST",
        body: JSON.stringify({ pilot_status: "contacted" }),
      }) as unknown as Parameters<typeof POST>[0],
      badCtx,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_lead_id");
  });

  it("returns 400 when no fields are supplied", async () => {
    adminOk();
    makeClient({});
    const res = await POST(postReq({}), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_fields");
  });
});
