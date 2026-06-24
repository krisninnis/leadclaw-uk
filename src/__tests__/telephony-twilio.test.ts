import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { TwilioProvider, computeTwilioSignature } from "@/lib/telephony/twilio";

const ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "TWILIO_MESSAGING_SERVICE_SID",
];

const originalEnv: Record<string, string | undefined> = {};
const originalFetch = global.fetch;

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("webhook payload parsing", () => {
  const provider = new TwilioProvider();

  it("parses an inbound voice webhook", () => {
    const parsed = provider.parseInboundVoiceWebhook({
      CallSid: "CA123",
      From: "+447700900123",
      To: "+441174960000",
      CallStatus: "ringing",
    });
    expect(parsed).toEqual({
      providerCallId: "CA123",
      fromRaw: "+447700900123",
      toRaw: "+441174960000",
      callStatus: "ringing",
    });
  });

  it("parses an inbound SMS webhook", () => {
    const parsed = provider.parseInboundSmsWebhook({
      MessageSid: "SM123",
      From: "+447700900123",
      To: "+441174960000",
      Body: "Leaking tap please help",
    });
    expect(parsed.providerMessageId).toBe("SM123");
    expect(parsed.fromRaw).toBe("+447700900123");
    expect(parsed.body).toBe("Leaking tap please help");
  });

  it("parses a message status webhook", () => {
    const parsed = provider.parseMessageStatusWebhook({
      MessageSid: "SM123",
      MessageStatus: "delivered",
    });
    expect(parsed.providerMessageId).toBe("SM123");
    expect(parsed.deliveryStatus).toBe("delivered");
  });
});

describe("validateWebhookSignature", () => {
  const url = "https://app.leadclaw.uk/api/webhooks/twilio/sms";
  const params = {
    From: "+447700900123",
    To: "+441174960000",
    Body: "Leaking tap",
    MessageSid: "SM123",
  };

  it("returns not_configured when no auth token is set", () => {
    const provider = new TwilioProvider();
    const result = provider.validateWebhookSignature({
      url,
      params,
      signature: "anything",
    });
    expect(result).toEqual({ valid: false, reason: "not_configured" });
  });

  it("accepts a correctly computed signature", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "test_token";
    const provider = new TwilioProvider();

    const signature = computeTwilioSignature("test_token", url, params);
    const result = provider.validateWebhookSignature({ url, params, signature });
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("valid");
  });

  it("known-answer regression vector (locks the algorithm)", () => {
    // Computed from the Twilio request-validation algorithm:
    // URL + sorted(key+value), HMAC-SHA1 with the auth token, base64.
    expect(
      computeTwilioSignature("test_token", url, params),
    ).toBe("mEhgd1gCaOk8O73VbMY7BjQSUaI=");
  });

  it("rejects a tampered signature", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "test_token";
    const provider = new TwilioProvider();
    const result = provider.validateWebhookSignature({
      url,
      params,
      signature: "not-the-right-signature==",
    });
    expect(result).toEqual({ valid: false, reason: "invalid" });
  });

  it("flags a missing signature when configured", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "test_token";
    const provider = new TwilioProvider();
    const result = provider.validateWebhookSignature({
      url,
      params,
      signature: null,
    });
    expect(result).toEqual({ valid: false, reason: "missing_signature" });
  });
});

describe("sendSms", () => {
  it("returns a clear error when Twilio env vars are missing (no crash)", async () => {
    const provider = new TwilioProvider();
    expect(provider.isConfigured()).toBe(false);
    const result = await provider.sendSms({ to: "+447700900123", body: "hi" });
    expect(result).toEqual({
      ok: false,
      provider: "twilio",
      error: "twilio_not_configured",
    });
  });

  it("sends via the REST API when configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "test_token";
    process.env.TWILIO_FROM_NUMBER = "+441174960000";

    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ sid: "SM_out_1" }),
    }));
    // @ts-expect-error partial fetch mock is sufficient for this test
    global.fetch = fetchMock;

    const provider = new TwilioProvider();
    const result = await provider.sendSms({
      to: "07700 900123",
      body: "Sorry we missed you",
    });

    expect(result).toEqual({
      ok: true,
      provider: "twilio",
      providerMessageId: "SM_out_1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a Twilio API error", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "test_token";
    process.env.TWILIO_FROM_NUMBER = "+441174960000";

    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ message: "The 'To' number is not valid" }),
    }));
    // @ts-expect-error partial fetch mock is sufficient for this test
    global.fetch = fetchMock;

    const provider = new TwilioProvider();
    const result = await provider.sendSms({ to: "+447700900123", body: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid/);
  });
});
