import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "@/app/api/widget/bootstrap.js/route";

const mockedCreateAdminClient = jest.mocked(createAdminClient);

const TOKEN = "tok_abcdef123456";

function resolving(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    b[m] = jest.fn(() => b);
  }
  b.maybeSingle = jest.fn(() => Promise.resolve(result));
  return b;
}

function mockAdmin() {
  mockedCreateAdminClient.mockReturnValue({
    from: (table: string) => {
      if (table === "widget_tokens") {
        return resolving({
          data: {
            token: TOKEN,
            status: "active",
            onboarding_site_id: "site_1",
            onboarding_sites: {
              id: "site_1",
              domain: "clinic.test",
              clinic_id: "clinic_1",
              status: "live",
              onboarding_client_id: "client_1",
            },
          },
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
        return resolving({ data: { status: "active" }, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as ReturnType<typeof createAdminClient>);
}

describe("GET /api/widget/bootstrap.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("includes a best-effort ping call to /api/widget/ping in the loaded widget", async () => {
    mockAdmin();

    const req = new NextRequest(
      `https://leadclaw.uk/api/widget/bootstrap.js?token=${TOKEN}`,
    );
    const res = await GET(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("/api/widget/ping");
    expect(body).toContain("__leadclawPinged");
    // Ping must be guarded so it only fires once and is fire-and-forget.
    expect(body).toContain("keepalive: true");
    expect(body).toMatch(/\.catch\(\(\) => \{\}\)/);
  });
});
