function makeLead(overrides = {}) {
  return {
    niche: "beauty",
    company_name: "Calm Clinic Ltd",
    website: "https://calmclinic.example",
    contact_email: "hello@calmclinic.example",
    contact_phone: "020 0000 0000",
    city: "London",
    source: "google-places",
    notes: "rating=4.8",
    ...overrides,
  };
}

function makeChain(finalResult) {
  return {
    limit: jest.fn().mockResolvedValue(finalResult),
  };
}

function makeAdmin({ existingLeads = [], insertError = null } = {}) {
  const existingSelect = makeChain({ data: existingLeads, error: null });
  const insert = jest.fn().mockResolvedValue({ error: insertError });

  const admin = {
    from: jest.fn((table) => {
      if (table !== "leads") throw new Error(`Unexpected table: ${table}`);

      return {
        select: jest.fn(() => existingSelect),
        insert,
      };
    }),
  };

  return { admin, existingSelect, insert };
}

async function postImport(
  body,
  headers = { authorization: "Bearer import-token" },
) {
  const { POST } = require("@/app/api/leads/import/route");

  const req = new Request("http://localhost:3000/api/leads/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const res = await POST(req);
  const responseBody = await res.json();

  return { res, body: responseBody };
}

describe("POST /api/leads/import", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.LEAD_IMPORT_TOKEN = "import-token";
  });

  it("accepts token-authenticated scraper imports", async () => {
    const mockDb = makeAdmin();

    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn(),
    }));

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    const { res, body } = await postImport({ leads: [makeLead()] });

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        inserted: 1,
        skipped: 0,
        auth: "token",
      }),
    );
    expect(mockDb.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        company_name: "Calm Clinic Ltd",
        status: "new",
        score: expect.any(Number),
      }),
    ]);
  });

  it("rejects incorrect import tokens without falling back to admin auth", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const requireAdmin = jest.fn();

    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin,
    }));

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn(),
    }));

    const { res, body } = await postImport(
      { leads: [makeLead()] },
      { authorization: "Bearer wrong-token" },
    );

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "unauthorized" });
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("import-token");
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("wrong-token");

    warnSpy.mockRestore();
  });

  it("deduplicates against existing leads before inserting", async () => {
    const mockDb = makeAdmin({
      existingLeads: [
        {
          id: "existing_1",
          company_name: "Calm Clinic Ltd",
          city: "London",
          website: "https://calmclinic.example/",
          contact_email: "hello@calmclinic.example",
        },
      ],
    });

    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn(),
    }));

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    const { body } = await postImport({
      leads: [
        makeLead(),
        makeLead({
          company_name: "Fresh Electrical Ltd",
          website: "https://freshelectrical.example",
          contact_email: "",
          niche: "electrician",
        }),
      ],
    });

    expect(body.inserted).toBe(1);
    expect(body.skipped).toBe(1);
    expect(body.skippedLeads).toEqual([
      { company_name: "Calm Clinic Ltd", reason: "duplicate" },
    ]);
    expect(mockDb.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        company_name: "Fresh Electrical Ltd",
        contact_email: null,
      }),
    ]);
  });

  it("skips obviously invalid websites", async () => {
    const mockDb = makeAdmin();

    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn(),
    }));

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    const { body } = await postImport({
      leads: [makeLead({ website: "javascript:alert(1)" })],
    });

    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        inserted: 0,
        skipped: 1,
        skippedLeads: [
          { company_name: "Calm Clinic Ltd", reason: "invalid_website" },
        ],
      }),
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
