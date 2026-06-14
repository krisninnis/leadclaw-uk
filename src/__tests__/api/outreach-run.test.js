function makeLead(overrides = {}) {
  const id = overrides.id || "lead_1";

  return {
    id,
    company_name: overrides.company_name || `Business ${id}`,
    city: "London",
    niche: "plumber",
    created_at: "2026-06-14T09:00:00.000Z",
    contact_email: overrides.contact_email || `${id}@example.co.uk`,
    status: "queued",
    score: 95,
    lead_quality_score: 95,
    pecr_classification: "corporate",
    company_number: "12345678",
    outreach_subject: "Reviewed subject",
    outreach_message: "Reviewed message",
    follow_up_stage: 0,
    last_contacted_at: null,
    ...overrides,
  };
}

function makeChain(finalResult) {
  return {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(finalResult),
  };
}

function makeAdmin({ leads = [], sentToday = [] } = {}) {
  const outreachEventsSelect = makeChain({ data: sentToday, error: null });
  const outreachEventsInsert = jest.fn().mockResolvedValue({ error: null });
  const outreachLogInsert = jest.fn().mockResolvedValue({ error: null });
  const leadsSelect = makeChain({ data: leads, error: null });
  const leadsUpdateChain = {
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockResolvedValue({ error: null }),
  };
  const leadsUpdate = jest.fn(() => leadsUpdateChain);

  const admin = {
    from: jest.fn((table) => {
      if (table === "outreach_events") {
        return {
          select: jest.fn(() => outreachEventsSelect),
          insert: outreachEventsInsert,
        };
      }

      if (table === "outreach_log") {
        return {
          insert: outreachLogInsert,
        };
      }

      if (table === "leads") {
        return {
          select: jest.fn(() => leadsSelect),
          update: leadsUpdate,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    admin,
    outreachEventsSelect,
    outreachEventsInsert,
    outreachLogInsert,
    leadsSelect,
    leadsUpdate,
    leadsUpdateChain,
  };
}

async function postOutreachRun(headers = { authorization: "Bearer test-token" }) {
  const { POST } = require("@/app/api/outreach/run/route");

  const req = new Request("http://localhost:3000/api/outreach/run", {
    method: "POST",
    headers,
  });

  const res = await POST(req);
  const body = await res.json();

  return { res, body };
}

describe("POST /api/outreach/run", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.OUTREACH_RUN_TOKEN = "test-token";
    process.env.OUTREACH_DAILY_CAP = "5";
    process.env.OUTREACH_BATCH_SIZE = "5";
    process.env.OUTREACH_MIN_LEAD_QUALITY_SCORE = "90";
    process.env.OUTREACH_PER_EMAIL_DELAY_MS = "0";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.leadclaw.uk";
  });

  it("returns 401 when bearer token is missing", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn(),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn(),
      sendEmail: jest.fn(),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn(),
    }));

    const { POST } = require("@/app/api/outreach/run/route");

    const req = new Request("http://localhost:3000/api/outreach/run", {
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(warnSpy).toHaveBeenCalledWith("[outreach.run] unauthorized", {
      tokenConfigured: "yes",
      authHeaderPresent: "no",
      outreachTokenHeaderPresent: "no",
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("test-token");

    warnSpy.mockRestore();
  });

  it("returns 400 when Supabase admin is not configured", async () => {
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(null),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn(),
      sendEmail: jest.fn(),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn(),
    }));

    const { res, body } = await postOutreachRun();

    expect(res.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "supabase_not_configured",
    });
  });

  it("accepts the explicit GitHub outreach token header", async () => {
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(null),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn(),
      sendEmail: jest.fn(),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn(),
    }));

    const { res, body } = await postOutreachRun({
      "x-outreach-run-token": "test-token",
    });

    expect(res.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "supabase_not_configured",
    });
  });

  it("accepts a case-insensitive bearer token with flexible spacing", async () => {
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(null),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn(),
      sendEmail: jest.fn(),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn(),
    }));

    const { res, body } = await postOutreachRun({
      authorization: "bearer   test-token   ",
    });

    expect(res.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "supabase_not_configured",
    });
  });

  it("rejects an incorrect explicit outreach token", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn(),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn(),
      sendEmail: jest.fn(),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn(),
    }));

    const { res, body } = await postOutreachRun({
      "x-outreach-run-token": "wrong-token",
    });

    expect(res.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(warnSpy).toHaveBeenCalledWith("[outreach.run] unauthorized", {
      tokenConfigured: "yes",
      authHeaderPresent: "no",
      outreachTokenHeaderPresent: "yes",
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("wrong-token");
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("test-token");

    warnSpy.mockRestore();
  });

  it("logs when the deployed route has no configured outreach token", async () => {
    delete process.env.OUTREACH_RUN_TOKEN;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn(),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn(),
      sendEmail: jest.fn(),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn(),
    }));

    const { res, body } = await postOutreachRun({
      authorization: "Bearer test-token",
    });

    expect(res.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(warnSpy).toHaveBeenCalledWith("[outreach.run] unauthorized", {
      tokenConfigured: "no",
      authHeaderPresent: "yes",
      outreachTokenHeaderPresent: "no",
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("test-token");

    warnSpy.mockRestore();
  });

  it("sends multiple eligible leads when batchSize is greater than 1", async () => {
    process.env.OUTREACH_BATCH_SIZE = "3";

    const mockDb = makeAdmin({
      leads: [
        makeLead({ id: "lead_1", contact_email: "one@example.co.uk" }),
        makeLead({ id: "lead_2", contact_email: "two@example.co.uk" }),
        makeLead({ id: "lead_3", contact_email: "three@example.co.uk" }),
        makeLead({ id: "lead_4", contact_email: "four@example.co.uk" }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn().mockResolvedValue(false),
      sendEmail: jest.fn().mockResolvedValue({
        ok: true,
        id: "email_123",
      }),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const emailModule = require("@/lib/email");
    const { res, body } = await postOutreachRun();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        sentCount: 3,
        skippedCount: 0,
        capped: false,
        dailyCap: 5,
        minLeadQualityScore: 90,
        sentToday: 3,
        batchSize: 3,
      }),
    );
    expect(emailModule.sendEmail).toHaveBeenCalledTimes(3);
    expect(mockDb.leadsUpdate).toHaveBeenCalledTimes(3);
    expect(mockDb.outreachLogInsert).toHaveBeenCalledTimes(3);
  });

  it("uses dailyCap to prevent over-sending", async () => {
    process.env.OUTREACH_DAILY_CAP = "5";
    process.env.OUTREACH_BATCH_SIZE = "5";

    const mockDb = makeAdmin({
      sentToday: [
        { id: "sent_1" },
        { id: "sent_2" },
        { id: "sent_3" },
        { id: "sent_4" },
      ],
      leads: [
        makeLead({ id: "lead_1", contact_email: "one@example.co.uk" }),
        makeLead({ id: "lead_2", contact_email: "two@example.co.uk" }),
        makeLead({ id: "lead_3", contact_email: "three@example.co.uk" }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn().mockResolvedValue(false),
      sendEmail: jest.fn().mockResolvedValue({
        ok: true,
        id: "email_123",
      }),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const emailModule = require("@/lib/email");
    const { res, body } = await postOutreachRun();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        sentCount: 1,
        sentToday: 5,
        capped: true,
        dailyCap: 5,
        batchSize: 5,
      }),
    );
    expect(emailModule.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockDb.outreachLogInsert).toHaveBeenCalledTimes(1);
  });

  it("writes one outreach_log row and updates lead outreach fields per successful email", async () => {
    const lead = makeLead({
      id: "lead_1",
      company_name: "Bright Clinic",
      contact_email: "owner@brightclinic.co.uk",
      company_number: "98765432",
      outreach_subject: "Worth a quick look?",
      outreach_message:
        "I'm building LeadClaw, a simple website assistant that helps capture enquiries before visitors drop off.",
    });
    const mockDb = makeAdmin({ leads: [lead] });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn().mockResolvedValue(false),
      sendEmail: jest.fn().mockResolvedValue({
        ok: true,
        id: "email_123",
      }),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const { res, body } = await postOutreachRun();

    expect(res.status).toBe(200);
    expect(body.sentCount).toBe(1);
    expect(mockDb.outreachLogInsert).toHaveBeenCalledTimes(1);
    expect(mockDb.outreachLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@brightclinic.co.uk",
        business_name: "Bright Clinic",
        subject: "AI receptionist idea for Bright Clinic",
        email_number: 1,
        status: "sent",
        classification: "corporate",
        company_number: "98765432",
        google_place_id: null,
      }),
    );
    expect(mockDb.leadsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "contacted",
        follow_up_stage: 1,
        outreach_subject: "AI receptionist idea for Bright Clinic",
        outreach_message: expect.stringContaining("AI receptionist"),
      }),
    );
  });

  it("regenerates stale stored copy with AI receptionist positioning and production links", async () => {
    const mockDb = makeAdmin({
      leads: [
        makeLead({
          id: "lead_1",
          company_name: "Pipe Pros",
          contact_email: "owner@pipepros.co.uk",
          niche: "plumber",
          outreach_subject: "Worth a quick look?",
          outreach_message:
            "I'm building LeadClaw, a simple website assistant that helps capture and follow up on enquiries before visitors drop off. https://leadclaw-uk.vercel.app/demo?source=outreach",
        }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn().mockResolvedValue(false),
      sendEmail: jest.fn().mockResolvedValue({
        ok: true,
        id: "email_123",
      }),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const emailModule = require("@/lib/email");
    const { body } = await postOutreachRun();
    const emailPayload = emailModule.sendEmail.mock.calls[0][0];

    expect(body.sentCount).toBe(1);
    expect(emailPayload.subject).toBe("AI receptionist idea for Pipe Pros");
    expect(emailPayload.text).toContain("AI receptionist");
    expect(emailPayload.text).toContain("missed calls");
    expect(emailPayload.text).toContain("emergency callout requests");
    expect(emailPayload.text).toContain(
      "https://www.leadclaw.uk/demo?source=outreach&lead=lead_1",
    );
    expect(emailPayload.text).toContain(
      "Unsubscribe: https://www.leadclaw.uk/api/unsubscribe?email=owner%40pipepros.co.uk",
    );
    expect(emailPayload.text).not.toContain("website assistant");
    expect(emailPayload.text).not.toContain("leadclaw-uk.vercel.app");
    expect(emailPayload.text).not.toContain("founding-client perks");
  });

  it.each([
    ["plumber", "emergency callout requests"],
    ["heating", "boiler breakdown enquiries"],
    ["electrician", "quote requests"],
    ["beauty", "consultation or booking enquiries"],
    ["general_service", "UK service businesses"],
  ])("keeps industry-specific outreach copy for %s", async (niche, expected) => {
    const mockDb = makeAdmin({
      leads: [
        makeLead({
          id: `lead_${niche}`,
          company_name: "Example Service Co",
          contact_email: `${niche}@service-example.co.uk`,
          niche,
          outreach_subject: "Worth a quick look?",
          outreach_message: "simple website assistant",
        }),
      ],
    });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn().mockResolvedValue(false),
      sendEmail: jest.fn().mockResolvedValue({
        ok: true,
        id: "email_123",
      }),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    const emailModule = require("@/lib/email");
    await postOutreachRun();

    expect(emailModule.sendEmail.mock.calls[0][0].text).toContain(expected);
  });

  it("does not select fake image or logo emails from the outreach query", async () => {
    const mockDb = makeAdmin({ leads: [] });

    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    jest.doMock("@/lib/email", () => ({
      isSuppressed: jest.fn().mockResolvedValue(false),
      sendEmail: jest.fn().mockResolvedValue({
        ok: true,
        id: "email_123",
      }),
    }));

    jest.doMock("@/lib/ops", () => ({
      logSystemEvent: jest.fn().mockResolvedValue(undefined),
    }));

    await postOutreachRun();

    expect(mockDb.leadsSelect.not).toHaveBeenCalledWith(
      "contact_email",
      "ilike",
      "%.png%",
    );
    expect(mockDb.leadsSelect.not).toHaveBeenCalledWith(
      "contact_email",
      "ilike",
      "%.jpg%",
    );
    expect(mockDb.leadsSelect.not).toHaveBeenCalledWith(
      "contact_email",
      "ilike",
      "%logo%",
    );
  });
});
