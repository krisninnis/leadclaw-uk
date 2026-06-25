// Phase 2A — Twilio SMS adapter tests.
//
// Covers the new COMMUNICATIONS_SMS_PROVIDER=twilio path through sendSms(), the
// preserved Phase 1 behaviour (no provider configured, mock still works), and
// the error mapping (missing config, invalid number, Twilio API failure). The
// underlying telephony Twilio provider performs its send over global fetch, so
// the network is mocked — no real request is ever made.

// Avoid loading the real Resend email helper (and its SDK) when index.ts is
// imported; SMS tests never touch email.
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => ({ ok: true, id: "resend_msg_1" })),
}));

import {
  sendSms,
  buildEventRow,
  __resetCommunicationsProviders,
} from "@/lib/communications";

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

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  __resetCommunicationsProviders();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  __resetCommunicationsProviders();
  global.fetch = realFetch;
});

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

describe("Phase 1 behaviour preserved", () => {
  it("returns provider_not_configured when no SMS provider is set", async () => {
    const result = await sendSms({ to: "+447700900123", body: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.channel).toBe("sms");
      expect(result.error).toBe("provider_not_configured");
    }
  });

  it("still sends via the mock provider, without any network call", async () => {
    process.env.COMMUNICATIONS_SMS_PROVIDER = "mock";
    __resetCommunicationsProviders();
    const fetchSpy = mockFetchOnce(() => ({ ok: true, status: 201, body: {} }));

    const result = await sendSms({ to: "+447700900123", body: "hi there" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("mock");
      expect(result.providerMessageId).toMatch(/^mock-sms-/);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Twilio SMS adapter", () => {
  it("returns provider_not_configured when twilio selected but env missing", async () => {
    process.env.COMMUNICATIONS_SMS_PROVIDER = "twilio";
    __resetCommunicationsProviders();
    const fetchSpy = mockFetchOnce(() => ({ ok: true, status: 201, body: {} }));

    const result = await sendSms({ to: "+447700900123", body: "hi" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.provider).toBe("twilio");
      expect(result.error).toBe("provider_not_configured");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends through Twilio and returns the message sid on success", async () => {
    process.env.COMMUNICATIONS_SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok_test";
    process.env.TWILIO_FROM_NUMBER = "+447700900000";
    __resetCommunicationsProviders();

    const fetchSpy = mockFetchOnce(() => ({
      ok: true,
      status: 201,
      body: { sid: "SM123abc" },
    }));

    const result = await sendSms({ to: "+447700900123", body: "Your appt is confirmed" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("twilio");
      expect(result.providerMessageId).toBe("SM123abc");
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // The request goes to Twilio's Messages endpoint for the account.
    const calledUrl = (fetchSpy.mock.calls[0] as unknown[])[0] as string;
    expect(calledUrl).toContain("/Accounts/AC_test/Messages.json");
  });

  it("maps an invalid recipient to invalid_recipient (no network call)", async () => {
    process.env.COMMUNICATIONS_SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok_test";
    process.env.TWILIO_FROM_NUMBER = "+447700900000";
    __resetCommunicationsProviders();

    const fetchSpy = mockFetchOnce(() => ({ ok: true, status: 201, body: {} }));

    const result = await sendSms({ to: "not-a-number", body: "hi" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.provider).toBe("twilio");
      expect(result.error).toBe("invalid_recipient");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps a Twilio API failure to send_failed", async () => {
    process.env.COMMUNICATIONS_SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok_test";
    process.env.TWILIO_FROM_NUMBER = "+447700900000";
    __resetCommunicationsProviders();

    const fetchSpy = mockFetchOnce(() => ({
      ok: false,
      status: 400,
      body: { message: "The 'To' number is not a valid phone number." },
    }));

    const result = await sendSms({ to: "+447700900123", body: "hi" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.provider).toBe("twilio");
      expect(result.error).toBe("send_failed");
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("event log redaction for SMS", () => {
  it("masks the recipient number and never stores the full body verbatim", () => {
    const row = buildEventRow({
      channel: "sms",
      direction: "outbound",
      provider: "twilio",
      status: "sent",
      toAddress: "+447700900123",
      bodyPreview: "Call +44 7700 900123 to confirm your appointment now please",
    });

    expect(row.to_address).toBe("***0123");
    expect(typeof row.body_preview).toBe("string");
    expect(row.body_preview as string).toContain("[phone]");
    expect(row.body_preview as string).not.toContain("900123");
  });
});
