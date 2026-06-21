function makeLead(overrides = {}) {
  return {
    id: overrides.id || "lead_1",
    company_name: overrides.company_name || "Example Salon",
    website: overrides.website || "https://examplesalon.co.uk",
    contact_email: overrides.contact_email ?? null,
    notes: overrides.notes || "{\"source\":\"google-places\"}",
    ...overrides,
  };
}

function makeSelectChain(finalResult) {
  return {
    not: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(finalResult),
  };
}

function makeUpdateChain(result = { error: null }) {
  return {
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockResolvedValue(result),
  };
}

function makeAdmin({ leads = [], updateResults = [] } = {}) {
  const selectChain = makeSelectChain({ data: leads, error: null });
  const updateCalls = [];
  const updateChains = [];
  const update = jest.fn((values) => {
    updateCalls.push(values);
    const result =
      updateResults.length > 0
        ? updateResults.shift()
        : { error: null };
    const chain = makeUpdateChain(result);
    updateChains.push(chain);
    return chain;
  });

  const admin = {
    from: jest.fn((table) => {
      if (table === "leads") {
        return {
          select: jest.fn(() => selectChain),
          update,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { admin, selectChain, update, updateCalls, updateChains };
}

async function postBackfillEmails(
  body = {},
  headers = { authorization: "Bearer test-token" },
) {
  const { POST } = require("@/app/api/leads/backfill-emails/route");

  const req = new Request("http://localhost:3000/api/leads/backfill-emails", {
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

describe("POST /api/leads/backfill-emails", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.OUTREACH_RUN_TOKEN = "test-token";
    process.env.LEAD_IMPORT_TOKEN = "import-token";
  });

  it("returns 401 without a valid token", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn(),
    }));

    jest.doMock("@/lib/leads/email-backfill", () => ({
      discoverEmailsForLeads: jest.fn(),
    }));

    const { res, body } = await postBackfillEmails({}, {});

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "unauthorized" });
    expect(warnSpy).toHaveBeenCalledWith(
      "[leads.backfill-emails] unauthorized",
      expect.objectContaining({
        outreachTokenConfigured: "yes",
        importTokenConfigured: "yes",
        authHeaderPresent: "no",
      }),
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("test-token");
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("import-token");

    warnSpy.mockRestore();
  });

  it("dry-runs email discovery without updating the database", async () => {
    const mockDb = makeAdmin({ leads: [makeLead()] });
    const discoverEmailsForLeads = jest.fn().mockResolvedValue([
      {
        id: "lead_1",
        contact_email: "info@examplesalon.co.uk",
        notes: "{\"email_collection\":\"website_public_contact_page\"}",
        status: "found",
      },
    ]);

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/leads/email-backfill", () => ({
      discoverEmailsForLeads,
    }));

    const { res, body } = await postBackfillEmails({ limit: 50 });

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        dryRun: true,
        inspectedCount: 1,
        updatedCount: 1,
        failedCount: 0,
        limit: 50,
      }),
    );
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(discoverEmailsForLeads).toHaveBeenCalledWith([
      {
        id: "lead_1",
        company_name: "Example Salon",
        website: "https://examplesalon.co.uk",
        notes: "{\"source\":\"google-places\"}",
      },
    ]);
    expect(mockDb.selectChain.not).toHaveBeenCalledWith("website", "is", null);
    expect(mockDb.selectChain.neq).toHaveBeenCalledWith("website", "");
    expect(mockDb.selectChain.or).toHaveBeenCalledWith(
      "contact_email.is.null,contact_email.eq.",
    );
  });

  it("updates only contact_email, notes, and updated_at when apply is true", async () => {
    const mockDb = makeAdmin({ leads: [makeLead()] });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/leads/email-backfill", () => ({
      discoverEmailsForLeads: jest.fn().mockResolvedValue([
        {
          id: "lead_1",
          contact_email: "INFO@ExampleSalon.co.uk",
          notes: "{\"email_collection\":\"website_public_contact_page\"}",
          status: "found",
        },
      ]),
    }));

    const { res, body } = await postBackfillEmails({ apply: true, limit: 5 });

    expect(res.status).toBe(200);
    expect(body.updatedCount).toBe(1);
    expect(Object.keys(mockDb.updateCalls[0]).sort()).toEqual([
      "contact_email",
      "notes",
      "updated_at",
    ]);
    expect(mockDb.updateCalls[0]).toEqual(
      expect.objectContaining({
        contact_email: "info@examplesalon.co.uk",
        notes: "{\"email_collection\":\"website_public_contact_page\"}",
        updated_at: expect.any(String),
      }),
    );
    expect(mockDb.updateChains[0].eq).toHaveBeenCalledWith("id", "lead_1");
    expect(mockDb.updateChains[0].or).toHaveBeenCalledWith(
      "contact_email.is.null,contact_email.eq.",
    );
  });

  it("skips leads when no email is discovered", async () => {
    const mockDb = makeAdmin({ leads: [makeLead()] });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/leads/email-backfill", () => ({
      discoverEmailsForLeads: jest.fn().mockResolvedValue([
        {
          id: "lead_1",
          contact_email: "",
          notes: "{\"email_collection\":\"website_public_email_not_found\"}",
          status: "not_found",
          reason: "no_safe_email_found",
        },
      ]),
    }));

    const { body } = await postBackfillEmails({ apply: true });

    expect(body).toEqual(
      expect.objectContaining({
        inspectedCount: 1,
        updatedCount: 0,
        skippedCount: 1,
        failedCount: 0,
      }),
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("reports bridge failures without creating or sending anything", async () => {
    const mockDb = makeAdmin({ leads: [makeLead()] });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/leads/email-backfill", () => ({
      discoverEmailsForLeads: jest
        .fn()
        .mockRejectedValue(new Error("email_discovery_timeout")),
    }));

    const { res, body } = await postBackfillEmails({ apply: true });

    expect(res.status).toBe(500);
    expect(body).toEqual(
      expect.objectContaining({
        ok: false,
        error: "email_discovery_timeout",
        inspectedCount: 1,
        updatedCount: 0,
        failedCount: 1,
      }),
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
