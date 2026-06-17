function makeRequest(url, body = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockAdminForConfig() {
  const upsert = jest.fn(() => ({
    select: jest.fn(() => ({
      single: jest.fn().mockResolvedValue({
        data: { id: "config_1", name: "Default Lead Finder" },
        error: null,
      }),
    })),
  }));

  return {
    admin: {
      from: jest.fn((table) => {
        if (table !== "lead_finder_configs") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return { upsert };
      }),
    },
    upsert,
  };
}

function mockAdminForRun() {
  const insert = jest.fn(() => ({
    select: jest.fn(() => ({
      single: jest.fn().mockResolvedValue({
        data: { id: "run_1" },
        error: null,
      }),
    })),
  }));
  const updatePayloads = [];
  const update = jest.fn((payload) => {
    updatePayloads.push(payload);
    return {
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
  });

  return {
    admin: {
      from: jest.fn((table) => {
        if (table !== "lead_finder_runs") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return { insert, update };
      }),
    },
    insert,
    update,
    updatePayloads,
  };
}

describe("Lead Finder admin API", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env.LEAD_FINDER_EXECUTION_MODE = "local";
    delete process.env.GITHUB_ACTIONS_DISPATCH_TOKEN;
    global.fetch = originalFetch;
  });

  afterEach(() => {
    delete process.env.LEAD_FINDER_EXECUTION_MODE;
    delete process.env.GITHUB_ACTIONS_DISPATCH_TOKEN;
    global.fetch = originalFetch;
  });

  it("rejects non-admin run requests", async () => {
    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn().mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ ok: false }), {
          status: 403,
        }),
      }),
    }));

    const { POST } = require("@/app/api/admin/lead-finder/run/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/admin/lead-finder/run", {
        locations: "Coventry",
      }),
    );

    expect(res.status).toBe(403);
  });

  it("validates custom mode before running the scraper", async () => {
    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn().mockResolvedValue({
        ok: true,
        user: { id: "admin_1", email: "admin@example.com" },
      }),
    }));
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn(),
    }));

    const { POST } = require("@/app/api/admin/lead-finder/run/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/admin/lead-finder/run", {
        niche_mode: "custom",
        locations: "Coventry",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Custom mode requires at least one niche.");
  });

  it("saves Lead Finder config through a service-role upsert", async () => {
    const mockDb = mockAdminForConfig();

    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn().mockResolvedValue({
        ok: true,
        user: { id: "admin_1", email: "admin@example.com" },
      }),
    }));
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    const { POST } = require("@/app/api/admin/lead-finder/configs/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/admin/lead-finder/configs", {
        niche_mode: "clinic",
        locations: "Coventry Birmingham",
        limit: 25,
        schedule_enabled: true,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockDb.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        niche_mode: "clinic",
        locations: ["Coventry", "Birmingham"],
        lead_limit: 25,
        schedule_enabled: true,
        created_by: "admin_1",
      }),
      { onConflict: "name" },
    );
  });

  it("records and summarises a local dry-run scraper execution", async () => {
    const mockDb = mockAdminForRun();
    const runLeadFinderScraper = jest.fn().mockResolvedValue({
      ok: true,
      command: "py",
      args: ["leadclaw-lead-scraper/places_batch.py", "--dry-run"],
      exitCode: 0,
      stdout: '{"event":"scraper_discovery_complete"}\n',
      stderr: "",
      summary: {
        discovered: 4,
        imported: null,
        would_import: 3,
        skipped: 1,
        emails_found: 2,
        errors: [],
      },
    });

    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn().mockResolvedValue({
        ok: true,
        user: { id: "admin_1", email: "admin@example.com" },
      }),
    }));
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));
    jest.doMock("@/lib/lead-finder", () => {
      const actual = jest.requireActual("@/lib/lead-finder");
      return {
        ...actual,
        runLeadFinderScraper,
      };
    });

    const { POST } = require("@/app/api/admin/lead-finder/run/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/admin/lead-finder/run", {
        niche_mode: "clinic",
        locations: "Coventry",
        dry_run: true,
        discover_emails: true,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        runId: "run_1",
        status: "completed",
      }),
    );
    expect(runLeadFinderScraper).toHaveBeenCalledWith(
      expect.objectContaining({
        dry_run: true,
        locations: ["Coventry"],
      }),
    );
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
        dry_run: true,
        execution_mode: "local",
        created_by: "admin_1",
      }),
    );
    expect(mockDb.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "completed",
        exit_code: 0,
        summary: expect.objectContaining({
          discovered: 4,
          execution_mode: "local",
          would_import: 3,
          emails_found: 2,
        }),
      }),
    );
  });

  it("returns a clear production error when the GitHub token is missing", async () => {
    process.env.LEAD_FINDER_EXECUTION_MODE = "github_actions";
    const mockDb = mockAdminForRun();

    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn().mockResolvedValue({
        ok: true,
        user: { id: "admin_1", email: "admin@example.com" },
      }),
    }));
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    const { POST } = require("@/app/api/admin/lead-finder/run/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/admin/lead-finder/run", {
        niche_mode: "clinic",
        locations: "Coventry",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: "GitHub Actions dispatch token is not configured.",
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("queues a production run by dispatching the GitHub Actions workflow", async () => {
    process.env.LEAD_FINDER_EXECUTION_MODE = "github_actions";
    process.env.GITHUB_ACTIONS_DISPATCH_TOKEN = "github-token";
    const mockDb = mockAdminForRun();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = fetchMock;

    jest.doMock("@/lib/api-auth", () => ({
      requireAdmin: jest.fn().mockResolvedValue({
        ok: true,
        user: { id: "admin_1", email: "admin@example.com" },
      }),
    }));
    jest.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: jest.fn().mockReturnValue(mockDb.admin),
    }));

    const { POST } = require("@/app/api/admin/lead-finder/run/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/admin/lead-finder/run", {
        niche_mode: "custom",
        niches: "plumber heating",
        locations: "Coventry Birmingham",
        limit: 25,
        discover_emails: true,
        email_discovery_max_pages: 7,
        dry_run: false,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        ok: true,
        runId: "run_1",
        status: "queued",
        executionMode: "github_actions",
        externalUrl:
          "https://github.com/krisninnis/leadclaw-uk/actions/workflows/lead-scraper.yml",
        message: "Run started in GitHub Actions.",
      }),
    );
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued",
        dry_run: false,
        execution_mode: "github_actions",
        external_url:
          "https://github.com/krisninnis/leadclaw-uk/actions/workflows/lead-scraper.yml",
        created_by: "admin_1",
      }),
    );
    expect(mockDb.updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "queued",
        error: null,
        external_url:
          "https://github.com/krisninnis/leadclaw-uk/actions/workflows/lead-scraper.yml",
        summary: expect.objectContaining({
          execution_mode: "github_actions",
          message: "GitHub Actions workflow dispatched.",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/krisninnis/leadclaw-uk/actions/workflows/lead-scraper.yml/dispatches",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer github-token",
        }),
        body: JSON.stringify({
          ref: "main",
          inputs: {
            dry_run: "false",
            limit: "25",
            niche_mode: "custom",
            niches: "plumber heating",
            locations: "Coventry Birmingham",
            discover_emails: "true",
            email_discovery_max_pages: "7",
          },
        }),
      }),
    );
  });
});
