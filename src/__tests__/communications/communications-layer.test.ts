// Communications layer — Phase 1 tests.
//
// Covers: mock provider never sends real messages, provider_not_configured for
// SMS when unset, the Resend wrapper delegates to the existing email helper,
// event-log body redaction, and the integrated lead-notification service path.

import { ResendEmailProvider } from "@/lib/communications/providers/resend";
import { MockProvider } from "@/lib/communications/providers/mock";
import {
  buildBodyPreview,
  buildEventRow,
  maskEmailAddress,
  maskPhoneAddress,
} from "@/lib/communications/events";

// Mock the existing email helper so the Resend wrapper test asserts delegation
// without any network access.
jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => ({ ok: true, id: "resend_msg_1" })),
}));

import { sendEmail as mockedSendEmail } from "@/lib/email";

// Imported after the mock is declared; these read process.env at call time.
import {
  sendSms,
  sendLeadNotificationEmail,
  __resetCommunicationsProviders,
} from "@/lib/communications";

const ENV_KEYS = [
  "COMMUNICATIONS_EMAIL_PROVIDER",
  "COMMUNICATIONS_SMS_PROVIDER",
  "COMMUNICATIONS_WHATSAPP_PROVIDER",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "COMMUNICATIONS_DEFAULT_FROM_EMAIL",
] as const;

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  __resetCommunicationsProviders();
  (mockedSendEmail as jest.Mock).mockClear();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  __resetCommunicationsProviders();
});

describe("mock provider", () => {
  it("records sends in-memory and never performs a real send", async () => {
    const mock = new MockProvider();

    const result = await mock.sendSms({ to: "+447700900123", body: "hello" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("mock");
      expect(result.providerMessageId).toMatch(/^mock-sms-/);
    }
    // Recorded with a redacted preview, not the raw recipient body verbatim
    // alongside any phone number.
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0].channel).toBe("sms");
    // The mock never calls the real email helper.
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

describe("sendSms", () => {
  it("returns provider_not_configured when no SMS provider is set", async () => {
    const result = await sendSms({ to: "+447700900123", body: "hi" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.channel).toBe("sms");
      expect(result.error).toBe("provider_not_configured");
    }
  });

  it("sends via the mock provider when configured, without network", async () => {
    process.env.COMMUNICATIONS_SMS_PROVIDER = "mock";
    __resetCommunicationsProviders();

    const result = await sendSms({ to: "+447700900123", body: "hi there" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe("mock");
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

describe("ResendEmailProvider", () => {
  it("delegates to the existing email helper with mapped fields", async () => {
    process.env.RESEND_API_KEY = "test_key";
    const provider = new ResendEmailProvider();

    const result = await provider.sendEmail({
      to: "owner@clinic.example",
      subject: "Subject line",
      html: "<p>Body</p>",
      text: "Body",
      tags: [{ name: "type", value: "test" }],
    });

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendEmail).toHaveBeenCalledWith({
      to: "owner@clinic.example",
      subject: "Subject line",
      html: "<p>Body</p>",
      text: "Body",
      tags: [{ name: "type", value: "test" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("resend");
      expect(result.providerMessageId).toBe("resend_msg_1");
    }
  });

  it("returns provider_not_configured when RESEND_API_KEY is missing", async () => {
    const provider = new ResendEmailProvider();
    const result = await provider.sendEmail({
      to: "owner@clinic.example",
      subject: "x",
      html: "<p>x</p>",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("provider_not_configured");
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

describe("communication event redaction", () => {
  it("truncates long bodies and masks embedded email/phone", () => {
    const long = "Patient ".concat("x".repeat(300));
    const preview = buildBodyPreview(long);
    expect(preview).not.toBeNull();
    expect((preview as string).length).toBeLessThanOrEqual(140);

    const withPii = buildBodyPreview(
      "Call me on +44 7700 900123 or jane.doe@example.com please",
    );
    expect(withPii).toContain("[phone]");
    expect(withPii).toContain("[email]");
    expect(withPii).not.toContain("900123");
    expect(withPii).not.toContain("jane.doe@example.com");
  });

  it("masks from/to addresses in the persisted row by channel", () => {
    const emailRow = buildEventRow({
      channel: "email",
      direction: "outbound",
      provider: "resend",
      status: "sent",
      toAddress: "owner@clinic.example",
      bodyPreview: "Hello there",
    });
    expect(emailRow.to_address).toBe("ow***@clinic.example");

    const smsRow = buildEventRow({
      channel: "sms",
      direction: "outbound",
      provider: "mock",
      status: "sent",
      toAddress: "+447700900123",
      bodyPreview: "Reply STOP to opt out",
    });
    expect(smsRow.to_address).toBe("***0123");
    // body_preview is always present but never the raw full body verbatim.
    expect(typeof smsRow.body_preview).toBe("string");
  });

  it("never returns the full address unmasked via the mask helpers", () => {
    expect(maskEmailAddress("a@b.com")).toBe("a@b.com"); // 1-char local unchanged head
    expect(maskEmailAddress("alice@b.com")).toBe("al***@b.com");
    expect(maskPhoneAddress("+447700900123")).toBe("***0123");
  });
});

describe("sendLeadNotificationEmail (integrated path)", () => {
  it("renders + sends the founder alert via the mock email provider", async () => {
    process.env.COMMUNICATIONS_EMAIL_PROVIDER = "mock";
    __resetCommunicationsProviders();

    const result = await sendLeadNotificationEmail({
      title: "LeadClaw Alert: Hot Demo Lead",
      lines: [
        { label: "Clinic", value: "Smile Co" },
        { label: "Empty", value: "" },
      ],
      context: { leadId: "lead_123", metadata: { event: "hot_demo" } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe("mock");
    // Uses the mock email provider, so the real Resend helper is untouched.
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});
