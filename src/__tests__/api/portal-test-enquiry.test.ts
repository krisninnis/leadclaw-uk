import { describe, it, expect, jest, beforeEach } from "@jest/globals";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  POST,
  TEST_ENQUIRY_NAME,
  TEST_ENQUIRY_SERVICE_PREFIX,
} from "@/app/api/portal/test-enquiry/route";

const mockedCreateClient = jest.mocked(createClient);
const mockedCreateAdminClient = jest.mocked(createAdminClient);

function resolving(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    b[m] = jest.fn(() => b);
  }
  b.maybeSingle = jest.fn(() => Promise.resolve(result));
  b.single = jest.fn(() => Promise.resolve(result));
  return b;
}

function mockServerAuth(email: string | null) {
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: { user: email ? { id: "user_1", email } : null },
        }),
      ),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

type Captured = { insert?: Record<string, unknown> };

function mockAdmin(captured: Captured) {
  mockedCreateAdminClient.mockReturnValue({
    from: (table: string) => {
      if (table === "subscriptions") {
        return resolving({
          data: { status: "active", plan: "growth" },
          error: null,
        });
      }
      if (table === "onboarding_clients") {
        return resolving({ data: { id: "client_1" }, error: null });
      }
      if (table === "onboarding_sites") {
        return resolving({
          data: { clinic_id: "clinic_1", domain: "clinic.test" },
          error: null,
        });
      }
      if (table === "enquiries") {
        return {
          insert: (payload: Record<string, unknown>) => {
            captured.insert = payload;
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({ data: { id: "enq_1" }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as ReturnType<typeof createAdminClient>);
}

describe("POST /api/portal/test-enquiry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a clearly marked test enquiry for the authenticated clinic", async () => {
    const captured: Captured = {};
    mockServerAuth("owner@clinic.test");
    mockAdmin(captured);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.test).toBe(true);
    expect(json.enquiryId).toBe("enq_1");

    // The stored enquiry must be unmistakably a test record.
    expect(captured.insert?.clinic_id).toBe("clinic_1");
    expect(captured.insert?.name).toBe(TEST_ENQUIRY_NAME);
    expect(String(captured.insert?.service)).toContain(
      TEST_ENQUIRY_SERVICE_PREFIX,
    );
    // It must be excluded from the real follow-up lifecycle.
    expect(captured.insert?.follow_up_eligible).toBe(false);
  });

  it("rejects unauthenticated requests", async () => {
    const captured: Captured = {};
    mockServerAuth(null);
    mockAdmin(captured);

    const res = await POST();
    expect(res.status).toBe(401);
    expect(captured.insert).toBeUndefined();
  });
});
