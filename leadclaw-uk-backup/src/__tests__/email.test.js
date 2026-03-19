const mockSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe("sendEmail", () => {
  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("returns resend_not_configured when API key is missing", async () => {
    process.env.RESEND_FROM_EMAIL = "LeadClaw <contact@leadclaw.uk>";
    const { sendEmail } = require("@/lib/email");

    const result = await sendEmail({
      to: "clinic@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({
      ok: false,
      error: "resend_not_configured",
    });
  });

  it("returns resend_from_not_configured when from email is missing", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const { sendEmail } = require("@/lib/email");

    const result = await sendEmail({
      to: "clinic@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({
      ok: false,
      error: "resend_from_not_configured",
    });
  });

  it("uses resend.emails.send and returns success", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "LeadClaw <contact@leadclaw.uk>";

    mockSend.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });

    const { sendEmail } = require("@/lib/email");

    const result = await sendEmail({
      to: "clinic@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: [{ name: "source", value: "outreach" }],
    });

    expect(result).toEqual({
      ok: true,
      id: "email_123",
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: "LeadClaw <contact@leadclaw.uk>",
      to: ["clinic@example.com"],
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: [{ name: "source", value: "outreach" }],
    });
  });

  it("returns resend error cleanly", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "LeadClaw <contact@leadclaw.uk>";

    mockSend.mockResolvedValue({
      data: null,
      error: { message: "rate_limit_exceeded" },
    });

    const { sendEmail } = require("@/lib/email");

    const result = await sendEmail({
      to: "clinic@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({
      ok: false,
      error: "rate_limit_exceeded",
    });
  });
});
