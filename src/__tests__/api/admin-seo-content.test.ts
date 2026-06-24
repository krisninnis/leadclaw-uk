import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/admin/seo-content/route";
import { POST } from "@/app/api/admin/seo-content/[slug]/route";
import { CONTENT_BACKLOG } from "@/lib/seo/content-engine";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedCreateAdminClient = jest.mocked(createAdminClient);

const KNOWN_SLUG = CONTENT_BACKLOG[0].slug;

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

function makeClient(tables: Record<string, unknown[]>) {
  const captured: Captured[] = [];
  const cursor: Record<string, number> = {};
  const client = {
    captured,
    from: jest.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      const methods = ["select", "order", "limit", "eq", "upsert", "insert", "update", "delete", "maybeSingle", "single"];
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
  mockedCreateAdminClient.mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);
  return client;
}

function postReq(slug: string, body: unknown) {
  return new Request(`http://localhost/api/admin/seo-content/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/admin/seo-content", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks non-admins with 403", async () => {
    adminForbidden();
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns the ranked backlog, summary, next article and clusters", async () => {
    adminOk();
    makeClient({ seo_content_status: [{ data: [], error: null }] });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.opportunities.length).toBeGreaterThanOrEqual(50);
    expect(body.opportunities[0].rank).toBe(1);
    expect(body.nextArticle).not.toBeNull();
    expect(body.clusters[0].key).toBe("missed-calls");
    expect(body.inventory.duplicates).toEqual([]);
    expect(body.statusTableReady).toBe(true);
  });

  it("degrades gracefully when the status table is missing", async () => {
    adminOk();
    makeClient({
      seo_content_status: [{ data: null, error: { message: 'relation "seo_content_status" does not exist' } }],
    });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.statusTableReady).toBe(false);
    expect(body.opportunities.every((o: { status: string }) => o.status === "backlog")).toBe(true);
  });

  it("merges persisted status into the queue", async () => {
    adminOk();
    makeClient({
      seo_content_status: [
        {
          data: [{ opportunity_slug: KNOWN_SLUG, status: "published", notes: null, updated_at: "2026-06-20T00:00:00Z" }],
          error: null,
        },
      ],
    });

    const res = await GET();
    const body = await res.json();
    const target = body.opportunities.find((o: { slug: string }) => o.slug === KNOWN_SLUG);
    expect(target.status).toBe("published");
    expect(body.summary.published).toBe(1);
  });
});

describe("POST /api/admin/seo-content/[slug]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks non-admins with 403", async () => {
    adminForbidden();
    const res = await POST(postReq(KNOWN_SLUG, { status: "planned" }), ctx(KNOWN_SLUG));
    expect(res.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an unknown opportunity slug", async () => {
    adminOk();
    makeClient({});
    const res = await POST(postReq("not-a-real-opportunity", { status: "planned" }), ctx("not-a-real-opportunity"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unknown_opportunity");
  });

  it("rejects an invalid status value", async () => {
    adminOk();
    makeClient({});
    const res = await POST(postReq(KNOWN_SLUG, { status: "live" }), ctx(KNOWN_SLUG));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_status");
  });

  it("returns 400 when no fields are supplied", async () => {
    adminOk();
    makeClient({});
    const res = await POST(postReq(KNOWN_SLUG, {}), ctx(KNOWN_SLUG));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_fields");
  });

  it("writes ONLY to seo_content_status (no other table touched)", async () => {
    adminOk();
    const client = makeClient({
      seo_content_status: [
        { data: { opportunity_slug: KNOWN_SLUG, status: "in_progress" }, error: null },
      ],
    });

    const res = await POST(postReq(KNOWN_SLUG, { status: "in_progress" }), ctx(KNOWN_SLUG));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    // Every captured DB op targeted only the overlay table.
    const tables = new Set(client.captured.map((c) => c.table));
    expect([...tables]).toEqual(["seo_content_status"]);
    // And the write was an upsert keyed by opportunity_slug.
    const upsert = client.captured.find((c) => c.method === "upsert");
    expect(upsert).toBeTruthy();
    expect((upsert!.args[0] as Record<string, unknown>).opportunity_slug).toBe(KNOWN_SLUG);
    expect((upsert!.args[0] as Record<string, unknown>).status).toBe("in_progress");
  });
});
