import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { NextResponse } from "next/server";

jest.mock("@/lib/api-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => ({ ok: true, id: "resend_msg_1" })),
}));

import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { __resetCommunicationsProviders } from "@/lib/communications";
import { POST } from "@/app/api/admin/communications/test-sms/route";

const mockedRequireAdmin = jest.mocked(requireAdmin);
const mockedCreateAdminClient = jest.mocked(createAdminClient);

const ENV_KEYS = [
  "COMMUNICATIONS_SMS_PROVIDER",
  "COMMUNICATIONS_DEFAULT_FROM_SMS",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "TWILIO_MESSAGING_SERVICE_SID",
] as const;

const savedEnv: Record<string, string | undefined> = {};
const realFetch = global.fetch;

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

function request(body: unknown) {
  return new Request("http://localhost/api/admin/communications/test-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeEventClient(eventId = "evt_test_1") {
  const single = jest.fn(async () => ({
    data: { id: eventId },
    error: null,
  }));
  const builder = {
    insert: jest.fn(() => builder),
    select: jest.fn(() => builder),
    single,
  };
  const client = {
    from: jest.fn(() => builder),
  };
  mockedCreateAdminClient.mockReturnValue(
    client as unknown as ReturnType<typeof createAdminClient>,
  );
  return { client, builder };
}

function mockFetchOnce(impl: () => { ok: boolean; status: number; body: unknown }) {
  const fn = jest.fn(async () => {
    const { ok, status, body } = impl();
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  jest.clearAllMocks();
  __resetCommunicationsProviders();
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  mockedCreateAdminClient.mockReset();
  __resetCommunicationsProviders();
  global.fetch = realFetch;
});

describe("POST /api/admin/communications/test-sms", () => {
  it("blocks non-admins", async () => {
    adminForbidden();

    const res = await POST(request({ to: "+447700900123" }));

    expect(res.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects invalid numbers before provider or event-log calls", async () => {
    adminOk();
    process.env.COMMUNICATIONS_SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.TWILIO_FROM_NUMBER = "+447700900000";
    const fetchSpy = mockFetchOnce(() => ({ ok: true, status: 201, body: {} }));

    const res = await POST(request({ to: "not-a-number", message: "hi" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      channel: "sms",
      provider: "twilio",
      error: "invalid_recipient",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns provider_not_configured when no SMS provider is configured", async () => {
    adminOk();
    const fetchSpy = mockFetchOnce(() => ({ ok: true, status: 201, body: {} }));

    const res = await POST(request({ to: "07700 900123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      channel: "sms",
      provider: "mock",
      error: "provider_not_configured",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("sends through the mock provider and logs one communication event", async () => {
    adminOk();
    process.env.COMMUNICATIONS_SMS_PROVIDER = "mock";
    const { client, builder } = makeEventClient("evt_mock_1");
    const fetchSpy = mockFetchOnce(() => ({ ok: true, status: 201, body: {} }));

    const res = await POST(request({ to: "07700 900123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      channel: "sms",
      provider: "mock",
      providerMessageId: "mock-sms-1",
      eventId: "evt_mock_1",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    const fromCalls = client.from.mock.calls as unknown as Array<[string]>;
    const insertCalls = builder.insert.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    expect(fromCalls[0][0]).toBe("communication_events");
    expect(insertCalls[0][0]).toMatchObject({
      channel: "sms",
      direction: "outbound",
      provider: "mock",
      status: "sent",
      to_address: "***0123",
      metadata: {
        source: "admin_sms_test",
        requestedBy: "admin-1",
      },
    });
  });

  it("routes through Twilio when configured, with network mocked", async () => {
    adminOk();
    process.env.COMMUNICATIONS_SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.TWILIO_FROM_NUMBER = "+447700900000";
    makeEventClient("evt_twilio_1");
    const fetchSpy = mockFetchOnce(() => ({
      ok: true,
      status: 201,
      body: { sid: "SM_test_123" },
    }));

    const res = await POST(request({ to: "+447700900123", message: "hi" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      channel: "sms",
      provider: "twilio",
      providerMessageId: "SM_test_123",
      eventId: "evt_twilio_1",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const fetchCalls = fetchSpy.mock.calls as unknown as Array<[string]>;
    expect(String(fetchCalls[0][0])).toContain(
      "/Accounts/AC_test/Messages.json",
    );
  });

  it("does not leak provider detail or secrets on send failure", async () => {
    adminOk();
    process.env.COMMUNICATIONS_SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "super-secret-token";
    process.env.TWILIO_FROM_NUMBER = "+447700900000";
    makeEventClient("evt_failed_1");
    mockFetchOnce(() => ({
      ok: false,
      status: 401,
      body: { message: "bad auth super-secret-token" },
    }));

    const res = await POST(request({ to: "+447700900123", message: "hi" }));
    const body = await res.json();
    const serialised = JSON.stringify(body);

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: false,
      channel: "sms",
      provider: "twilio",
      error: "send_failed",
    });
    expect(serialised).not.toContain("super-secret-token");
    expect(serialised).not.toContain("detail");
  });
});
