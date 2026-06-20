import { describe, it, expect, jest, beforeEach } from "@jest/globals";

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "@/app/api/widget/ping/route";

const mockedCreateAdminClient = jest.mocked(createAdminClient);

const TOKEN = "tok_abcdef123456";

function resolving(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    b[m] = jest.fn(() => b);
  }
  b.maybeSingle = jest.fn(() => Promise.resolve(result));
  b.single = jest.fn(() => Promise.resolve(result));
  return b;
}

type Captured = { update?: Record<string, unknown>; updatedId?: string };

function mockAdmin(
  captured: Captured,
  opts: { subscriptionStatus?: string | null } = {},
) {
  let widgetTokenCalls = 0;

  mockedCreateAdminClient.mockReturnValue({
    from: (table: string) => {
      if (table === "widget_tokens") {
        widgetTokenCalls += 1;
        if (widgetTokenCalls === 1) {
          return resolving({
            data: {
              id: "wt_1",
              token: TOKEN,
              status: "active",
              onboarding_site_id: "site_1",
            },
            error: null,
          });
        }
        // Second call: the last_seen update.
        return {
          update: (payload: Record<string, unknown>) => {
            captured.update = payload;
            return {
              eq: (_col: string, value: string) => {
                captured.updatedId = value;
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === "onboarding_sites") {
        return resolving({
          data: { onboarding_client_id: "client_1" },
          error: null,
        });
      }
      if (table === "onboarding_clients") {
        return resolving({
          data: { contact_email: "owner@clinic.test" },
          error: null,
        });
      }
      if (table === "subscriptions") {
        return resolving({
          data: { status: opts.subscriptionStatus ?? "active" },
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as ReturnType<typeof createAdminClient>);
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/widget/ping", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://clinic.test" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/widget/ping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates last_seen_at and last_seen_domain for a valid active token", async () => {
    const captured: Captured = {};
    mockAdmin(captured);

    const before = Date.now();
    const res = await POST(makeRequest({ token: TOKEN, domain: "Clinic.Test" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(captured.updatedId).toBe("wt_1");
    expect(typeof captured.update?.last_seen_at).toBe("string");
    // Stored timestamp should be a recent ISO date.
    const seenMs = new Date(String(captured.update?.last_seen_at)).getTime();
    expect(seenMs).toBeGreaterThanOrEqual(before - 1000);
    // Domain is normalised to lower case.
    expect(captured.update?.last_seen_domain).toBe("clinic.test");
  });

  it("rejects an inactive subscription without updating last_seen", async () => {
    const captured: Captured = {};
    mockAdmin(captured, { subscriptionStatus: "unpaid" });

    const res = await POST(makeRequest({ token: TOKEN, domain: "clinic.test" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(captured.update).toBeUndefined();
  });

  it("rejects an invalid request body", async () => {
    const captured: Captured = {};
    mockAdmin(captured);

    const res = await POST(makeRequest({ token: "short", domain: "" }));
    expect(res.status).toBe(400);
    expect(captured.update).toBeUndefined();
  });
});
