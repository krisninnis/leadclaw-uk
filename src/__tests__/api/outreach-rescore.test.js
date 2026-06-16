function makeLead(overrides = {}) {
  return {
    id: overrides.id || "lead_1",
    company_name: overrides.company_name || "Fairway Electrical (Bristol) Ltd",
    website: overrides.website || "https://fairwayelectricalbristol.co.uk",
    contact_email: overrides.contact_email || "info@fairwayelectricalbristol.co.uk",
    contact_phone: overrides.contact_phone || "0117 239 4701",
    city: "Bristol",
    niche: "electrician",
    source: "google-places",
    status: "queued",
    score: 100,
    lead_score: 100,
    google_rating: 5,
    review_count: 246,
    has_live_chat: false,
    has_contact_form: true,
    pecr_classification: "corporate",
    pecr_reason: "Existing PECR classification preserved.",
    company_number: "12345678",
    lead_quality_score: 10,
    lead_quality_reason: "Old compressed score",
    outreach_subject: "Reviewed subject",
    outreach_message: "Reviewed message",
    ...overrides,
  };
}

function makeSelectChain(finalResult) {
  return {
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(finalResult),
  };
}

function makeUpdateChain(result = { error: null }) {
  return {
    eq: jest.fn().mockResolvedValue(result),
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

async function postRescore(
  body = {},
  headers = { authorization: "Bearer test-token" },
) {
  const { POST } = require("@/app/api/outreach/rescore/route");

  const req = new Request("http://localhost:3000/api/outreach/rescore", {
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

describe("POST /api/outreach/rescore", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.OUTREACH_RUN_TOKEN = "test-token";
  });

  it("returns 401 when the outreach token is missing", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn(),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn(),
    }));

    const { res, body } = await postRescore({}, {});

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "unauthorized" });
    expect(warnSpy).toHaveBeenCalledWith("[outreach.rescore] unauthorized", {
      tokenConfigured: "yes",
      authHeaderPresent: "no",
      outreachTokenHeaderPresent: "no",
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("test-token");

    warnSpy.mockRestore();
  });

  it("dry-runs rescoring without updating the database", async () => {
    const mockDb = makeAdmin({ leads: [makeLead()] });
    const logSystemEvent = jest.fn().mockResolvedValue(undefined);

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent,
    }));

    const { res, body } = await postRescore({ limit: 10 });

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        dryRun: true,
        inspectedCount: 1,
        updatedCount: 1,
        skippedCount: 0,
        failedCount: 0,
      }),
    );
    expect(body.results[0]).toEqual(
      expect.objectContaining({
        id: "lead_1",
        previousScore: 10,
        nextScore: 100,
        fields: ["lead_quality_score", "lead_quality_reason"],
        applied: false,
      }),
    );
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(logSystemEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "info",
        category: "outreach",
      }),
    );
  });

  it("updates only score, reason, and updated_at when apply is true", async () => {
    const mockDb = makeAdmin({
      leads: [
        makeLead({
          outreach_subject: "Do not touch subject",
          outreach_message: "Do not touch message",
        }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const { res, body } = await postRescore({ apply: true });

    expect(res.status).toBe(200);
    expect(body.updatedCount).toBe(1);
    expect(body.results[0]).toEqual(
      expect.objectContaining({
        id: "lead_1",
        applied: true,
        previousScore: 10,
        nextScore: 100,
      }),
    );
    expect(Object.keys(mockDb.updateCalls[0]).sort()).toEqual([
      "lead_quality_reason",
      "lead_quality_score",
      "updated_at",
    ]);
    expect(mockDb.updateCalls[0]).toEqual(
      expect.objectContaining({
        lead_quality_score: 100,
        lead_quality_reason: expect.stringContaining("Hot lead quality (100)"),
        updated_at: expect.any(String),
      }),
    );
    expect(mockDb.updateCalls[0]).not.toHaveProperty("outreach_subject");
    expect(mockDb.updateCalls[0]).not.toHaveProperty("outreach_message");
    expect(mockDb.updateCalls[0]).not.toHaveProperty("status");
    expect(mockDb.updateCalls[0]).not.toHaveProperty("pecr_classification");
    expect(mockDb.updateChains[0].eq).toHaveBeenCalledWith("id", "lead_1");
  });

  it("applies an ids filter and uses ids length as the limit", async () => {
    const mockDb = makeAdmin({
      leads: [
        makeLead({ id: "lead_1" }),
        makeLead({ id: "lead_2", lead_quality_score: 20 }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    await postRescore({
      ids: ["lead_1", "lead_2", ""],
      limit: 100,
    });

    expect(mockDb.selectChain.in).toHaveBeenCalledWith("id", [
      "lead_1",
      "lead_2",
    ]);
    expect(mockDb.selectChain.limit).toHaveBeenCalledWith(2);
  });

  it("applies a created_after filter", async () => {
    const mockDb = makeAdmin({ leads: [makeLead()] });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    await postRescore({ created_after: "2026-06-12" });

    expect(mockDb.selectChain.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-06-12T00:00:00.000Z",
    );
  });

  it("skips unchanged scores", async () => {
    const mockDb = makeAdmin({
      leads: [
        makeLead({
          lead_quality_score: 100,
          lead_quality_reason:
            "Hot lead quality (100): +20 website present; +25 valid email found; +15 phone present; +10 HTTPS website; +10 contact page discovered; +10 Google rating >= 4.5; +10 review count >= 20",
        }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const { body } = await postRescore({ apply: true });

    expect(body).toEqual(
      expect.objectContaining({
        updatedCount: 0,
        skippedCount: 1,
        failedCount: 0,
      }),
    );
    expect(body.results[0]).toEqual(
      expect.objectContaining({
        skippedReason: "score_unchanged",
        fields: [],
        applied: false,
      }),
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
