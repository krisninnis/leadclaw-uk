function makeLead(overrides = {}) {
  return {
    id: overrides.id || "lead_1",
    company_name: overrides.company_name || "Fairway Electrical (Bristol) Ltd",
    website: overrides.website || "https://fairwayelectricalbristol.co.uk",
    contact_email: overrides.contact_email || "info@fairwayelectricalbristol.co.uk",
    contact_phone: "0117 239 4701",
    city: "Bristol",
    niche: "electrician",
    source: "google-places",
    status: "new",
    score: 100,
    lead_score: 100,
    google_rating: 5,
    review_count: 246,
    has_live_chat: false,
    has_contact_form: true,
    pecr_classification: null,
    pecr_reason: null,
    company_number: null,
    lead_quality_score: null,
    lead_quality_reason: null,
    outreach_subject: null,
    outreach_message: null,
    ...overrides,
  };
}

function makeSelectChain(finalResult) {
  return {
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(finalResult),
  };
}

function makeAdmin({ leads = [], updateResults = [] } = {}) {
  const selectChain = makeSelectChain({ data: leads, error: null });
  const updateCalls = [];
  const update = jest.fn((values) => {
    updateCalls.push(values);
    const result =
      updateResults.length > 0
        ? updateResults.shift()
        : { error: null };

    return {
      eq: jest.fn().mockResolvedValue(result),
    };
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

  return { admin, selectChain, update, updateCalls };
}

async function postBackfill(
  body = {},
  headers = { authorization: "Bearer test-token" },
) {
  const { POST } = require("@/app/api/outreach/backfill/route");

  const req = new Request("http://localhost:3000/api/outreach/backfill", {
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

describe("POST /api/outreach/backfill", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.OUTREACH_RUN_TOKEN = "test-token";
  });

  it("dry-runs enrichment for a contactable corporate lead", async () => {
    const mockDb = makeAdmin({ leads: [makeLead()] });
    const logSystemEvent = jest.fn().mockResolvedValue(undefined);

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent,
    }));

    const { res, body } = await postBackfill();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        dryRun: true,
        inspectedCount: 1,
        updatedCount: 1,
        failedCount: 0,
      }),
    );
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(body.results[0]).toEqual(
      expect.objectContaining({
        id: "lead_1",
        applied: false,
        fields: expect.arrayContaining([
          "pecr_classification",
          "lead_quality_score",
          "outreach_subject",
          "outreach_message",
        ]),
      }),
    );
    expect(logSystemEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "info",
        category: "outreach",
      }),
    );
  });

  it("generates outreach copy when contact email is missing but website or phone exists", async () => {
    const mockDb = makeAdmin({
      leads: [
        makeLead({
          id: "lead_no_email",
          company_name: "ProTecBoilers Leeds",
          contact_email: null,
          niche: "heating",
        }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const { body } = await postBackfill();

    expect(body.results[0]).toEqual(
      expect.objectContaining({
        id: "lead_no_email",
        fields: expect.arrayContaining([
          "pecr_classification",
          "lead_quality_score",
          "outreach_subject",
          "outreach_message",
        ]),
        skippedReasons: [],
      }),
    );
  });

  it("persists generated outreach copy during apply even without contact email", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const mockDb = makeAdmin({
      leads: [
        makeLead({
          id: "lead_no_email_apply",
          company_name: "BOILER MAN (YORKSHIRE)",
          contact_email: null,
          contact_phone: "0113 000 0000",
          website: "https://boilermanyorkshire.example",
          niche: "heating",
        }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const { res, body } = await postBackfill({ apply: true });

    expect(res.status).toBe(200);
    expect(body.results[0]).toEqual(
      expect.objectContaining({
        id: "lead_no_email_apply",
        applied: true,
        fields: expect.arrayContaining([
          "lead_quality_score",
          "outreach_subject",
          "outreach_message",
        ]),
      }),
    );
    expect(mockDb.updateCalls[0]).toEqual(
      expect.objectContaining({
        outreach_subject: "Quick idea for BOILER MAN (YORKSHIRE)",
        outreach_message: expect.stringContaining("AI receptionist"),
      }),
    );
    expect(mockDb.updateCalls[0].outreach_message).toContain(
      "Unsubscribe: https://www.leadclaw.uk/api/unsubscribe",
    );
    expect(logSpy).toHaveBeenCalledWith(
      "[outreach.backfill] outreach copy generated",
      expect.objectContaining({
        leadId: "lead_no_email_apply",
        subjectGenerated: "Quick idea for BOILER MAN (YORKSHIRE)",
        messageGenerated: true,
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      "[outreach.backfill] lead update saved",
      expect.objectContaining({
        leadId: "lead_no_email_apply",
        saveSucceeded: true,
      }),
    );

    logSpy.mockRestore();
  });

  it("does not generate outreach copy when both website and phone are missing", async () => {
    const mockDb = makeAdmin({
      leads: [
        makeLead({
          id: "lead_no_presence",
          company_name: "Unknown Local Business",
          website: null,
          contact_phone: null,
          contact_email: null,
        }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const { body } = await postBackfill();

    expect(body.results[0]).toEqual(
      expect.objectContaining({
        id: "lead_no_presence",
        fields: expect.arrayContaining([
          "pecr_classification",
          "lead_quality_score",
        ]),
        skippedReasons: ["missing_website_or_phone"],
      }),
    );
    expect(body.results[0].fields).not.toContain("outreach_subject");
    expect(body.results[0].fields).not.toContain("outreach_message");
  });

  it("reports partial update failures when apply is enabled", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const logSystemEvent = jest.fn().mockResolvedValue(undefined);
    const mockDb = makeAdmin({
      leads: [
        makeLead({ id: "lead_ok" }),
        makeLead({ id: "lead_fail", company_name: "Failed Electrical Ltd" }),
      ],
      updateResults: [
        { error: null },
        { error: { message: "database timeout" } },
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent,
    }));

    const { res, body } = await postBackfill({ apply: true, limit: 2 });

    expect(res.status).toBe(207);
    expect(body).toEqual(
      expect.objectContaining({
        ok: false,
        dryRun: false,
        inspectedCount: 2,
        updatedCount: 1,
        failedCount: 1,
      }),
    );
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "lead_ok", applied: true }),
        expect.objectContaining({
          id: "lead_fail",
          applied: false,
          error: "database timeout",
        }),
      ]),
    );
    expect(logSystemEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warn",
        category: "outreach",
      }),
    );

    warnSpy.mockRestore();
  });
});
