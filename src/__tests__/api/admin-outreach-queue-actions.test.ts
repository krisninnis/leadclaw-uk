import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/email", () => ({ suppressEmail: jest.fn() }));

import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { suppressEmail } from "@/lib/email";
import { POST as skipPOST } from "@/app/api/admin/outreach/queue/skip/route";
import { POST as calledPOST } from "@/app/api/admin/outreach/queue/mark-called/route";
import { POST as dncPOST } from "@/app/api/admin/outreach/queue/do-not-contact/route";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedCreateAdminClient = jest.mocked(createAdminClient);
const mockedSuppressEmail = jest.mocked(suppressEmail);

function adminOk() {
  mockedRequireAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@leadclaw.uk" },
  });
}

function adminForbidden() {
  mockedRequireAdmin.mockResolvedValue({
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    ),
  });
}

type AdminMock = {
  admin: ReturnType<typeof createAdminClient>;
  upsert: jest.Mock;
};

// Build an admin client mock handling both `leads` and `outreach_queue`.
function makeAdmin(
  leadRow: Record<string, unknown> | null = { id: "lead_1", contact_email: "owner@acme.co.uk" },
): AdminMock {
  const upsert = jest.fn(() => ({
    select: () => ({
      maybeSingle: async () => ({ data: { id: "queue_1" }, error: null }),
    }),
  }));

  const leadsBuilder = {
    select: () => leadsBuilder,
    eq: () => leadsBuilder,
    maybeSingle: async () => ({ data: leadRow, error: null }),
  };

  const admin = {
    from: jest.fn((table: string) => {
      if (table === "leads") return leadsBuilder;
      if (table === "outreach_queue") return { upsert };
      throw new Error(`unexpected table ${table}`);
    }),
  } as unknown as ReturnType<typeof createAdminClient>;

  mockedCreateAdminClient.mockReturnValue(admin);
  return { admin, upsert };
}

function jsonReq(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as Parameters<typeof skipPOST>[0];
}

const SKIP_URL = "http://localhost/api/admin/outreach/queue/skip";
const CALLED_URL = "http://localhost/api/admin/outreach/queue/mark-called";
const DNC_URL = "http://localhost/api/admin/outreach/queue/do-not-contact";

describe("outreach queue action routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSuppressEmail.mockResolvedValue({ data: {}, error: null });
  });

  describe("auth + validation", () => {
    it("blocks non-admins on all three routes", async () => {
      adminForbidden();
      expect((await skipPOST(jsonReq(SKIP_URL, { lead_id: "x" }))).status).toBe(403);
      adminForbidden();
      expect((await calledPOST(jsonReq(CALLED_URL, { lead_id: "x" }))).status).toBe(403);
      adminForbidden();
      expect((await dncPOST(jsonReq(DNC_URL, { lead_id: "x" }))).status).toBe(403);
    });

    it("rejects missing lead_id with 400", async () => {
      adminOk();
      makeAdmin();
      expect((await skipPOST(jsonReq(SKIP_URL, {}))).status).toBe(400);
      expect((await calledPOST(jsonReq(CALLED_URL, {}))).status).toBe(400);
      expect((await dncPOST(jsonReq(DNC_URL, {}))).status).toBe(400);
    });
  });

  describe("skip", () => {
    it("creates/updates the queue row with status skipped", async () => {
      adminOk();
      const { upsert } = makeAdmin();
      const res = await skipPOST(jsonReq(SKIP_URL, { lead_id: "lead_1" }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true, status: "skipped" });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lead_id: "lead_1",
          status: "skipped",
          skipped_at: expect.any(String),
        }),
        { onConflict: "lead_id" },
      );
    });
  });

  describe("mark-called", () => {
    it("creates/updates the queue row with status called", async () => {
      adminOk();
      const { upsert } = makeAdmin();
      const res = await calledPOST(jsonReq(CALLED_URL, { lead_id: "lead_1" }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true, status: "called" });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lead_id: "lead_1",
          status: "called",
          called_at: expect.any(String),
        }),
        { onConflict: "lead_id" },
      );
    });
  });

  describe("do-not-contact", () => {
    it("creates queue row, stamps do_not_contact_at, and suppresses the email", async () => {
      adminOk();
      const { upsert } = makeAdmin({
        id: "lead_1",
        contact_email: "owner@acme.co.uk",
      });
      const res = await dncPOST(jsonReq(DNC_URL, { lead_id: "lead_1" }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true, status: "do_not_contact" });
      expect(mockedSuppressEmail).toHaveBeenCalledWith(
        "owner@acme.co.uk",
        "do_not_contact",
      );
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          lead_id: "lead_1",
          status: "do_not_contact",
          do_not_contact_at: expect.any(String),
        }),
        { onConflict: "lead_id" },
      );
    });

    it("uses a body-supplied email when the lead has none", async () => {
      adminOk();
      makeAdmin({ id: "lead_1", contact_email: null });
      const res = await dncPOST(
        jsonReq(DNC_URL, { lead_id: "lead_1", email: "fallback@acme.co.uk" }),
      );

      expect(res.status).toBe(200);
      expect(mockedSuppressEmail).toHaveBeenCalledWith(
        "fallback@acme.co.uk",
        "do_not_contact",
      );
    });

    it("returns 400 when the lead has no email and none is supplied", async () => {
      adminOk();
      makeAdmin({ id: "lead_1", contact_email: null });
      const res = await dncPOST(jsonReq(DNC_URL, { lead_id: "lead_1" }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("email_required");
      expect(mockedSuppressEmail).not.toHaveBeenCalled();
    });
  });
});
