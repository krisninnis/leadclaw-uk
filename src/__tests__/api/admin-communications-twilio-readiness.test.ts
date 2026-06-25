import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));

import { requireAdmin } from "@/lib/api-auth";
import { GET } from "@/app/api/admin/communications/twilio-readiness/route";

const mockedRequireAdmin = jest.mocked(requireAdmin);

const ENV_KEYS = [
  "COMMUNICATIONS_SMS_PROVIDER",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "TWILIO_MESSAGING_SERVICE_SID",
  "COMMUNICATIONS_DEFAULT_FROM_SMS",
] as const;

const savedEnv: Record<string, string | undefined> = {};

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

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  jest.clearAllMocks();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("GET /api/admin/communications/twilio-readiness", () => {
  it("blocks non-admin users", async () => {
    adminForbidden();

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns read-only readiness without leaking secret env values", async () => {
    adminOk();
    process.env.COMMUNICATIONS_SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC11111111111111111111111111111111";
    process.env.TWILIO_AUTH_TOKEN = "super-secret-token";
    process.env.TWILIO_FROM_NUMBER = "+447700900000";

    const res = await GET();
    const body = await res.json();
    const serialised = JSON.stringify(body);

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.readiness.ready).toBe(true);
    expect(body.readiness.senderMode).toBe("from_number");
    expect(serialised).not.toContain("super-secret-token");
    expect(serialised).not.toContain("AC11111111111111111111111111111111");
    expect(serialised).not.toContain("+447700900000");
  });
});
