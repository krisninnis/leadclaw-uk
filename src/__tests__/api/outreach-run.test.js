function makeAdminWithOneLead() {
  const outreachEventsSelect = {
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [] }),
  };

  const leadsSelect = {
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: [
        {
          id: "lead_1",
          company_name: "Bright Clinic",
          city: "London",
          contact_email: "owner@brightclinic.co.uk",
          status: "new",
          score: 95,
          outreach_subject: null,
          outreach_message: null,
          follow_up_stage: 0,
          last_contacted_at: null,
        },
      ],
      error: null,
    }),
  };

  return {
    from: jest.fn((table) => {
      if (table === "outreach_events") {
        return {
          select: jest.fn(() => outreachEventsSelect),
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "leads") {
        return {
          select: jest.fn(() => leadsSelect),
          update: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("POST /api/outreach/run", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.OUTREACH_RUN_TOKEN = "test-token";
    process.env.OUTREACH_DAILY_CAP = "20";
    process.env.NEXT_PUBLIC_APP_URL = "https://leadclaw.uk";
  });

  it("returns 401 when bearer token is missing", async () => {
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

    const { POST } = require("@/app/api/outreach/run/route");

    const req = new Request("http://localhost:3000/api/outreach/run", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "supabase_not_configured",
    });
  });

  it("sends one outreach email successfully", async () => {
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(makeAdminWithOneLead()),
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

    const { POST } = require("@/app/api/outreach/run/route");
    const emailModule = require("@/lib/email");
    const opsModule = require("@/lib/ops");

    const req = new Request("http://localhost:3000/api/outreach/run", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);

    expect(body).toEqual({
      ok: true,
      sentCount: 1,
      skippedCount: 0,

      sent: [
        {
          id: "lead_1",
          email: "owner@brightclinic.co.uk",
          subject: "Quick question for Bright Clinic",
        },
      ],
      skipped: [],
      capped: false,
      dailyCap: 20,
      sentToday: 1,
    });

    expect(emailModule.sendEmail).toHaveBeenCalledTimes(1);
    expect(opsModule.logSystemEvent).toHaveBeenCalled();
  });
});
