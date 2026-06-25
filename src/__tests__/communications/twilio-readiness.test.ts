import { getTwilioSmsReadiness } from "@/lib/communications/twilio-readiness";

describe("getTwilioSmsReadiness", () => {
  it("is ready when provider, credentials and from number are present", () => {
    const readiness = getTwilioSmsReadiness({
      COMMUNICATIONS_SMS_PROVIDER: "twilio",
      TWILIO_ACCOUNT_SID: "AC11111111111111111111111111111111",
      TWILIO_AUTH_TOKEN: "super-secret-token",
      TWILIO_FROM_NUMBER: "+447700900000",
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.senderMode).toBe("from_number");
    expect(readiness.missing).toEqual([]);
    expect(JSON.stringify(readiness)).not.toContain("super-secret-token");
    expect(JSON.stringify(readiness)).not.toContain("+447700900000");
  });

  it("accepts a Messaging Service SID as the sender source", () => {
    const readiness = getTwilioSmsReadiness({
      COMMUNICATIONS_SMS_PROVIDER: "twilio",
      TWILIO_ACCOUNT_SID: "AC11111111111111111111111111111111",
      TWILIO_AUTH_TOKEN: "super-secret-token",
      TWILIO_MESSAGING_SERVICE_SID: "MG22222222222222222222222222222222",
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.senderMode).toBe("messaging_service");
    expect(readiness.missing).toEqual([]);
  });

  it("reports missing required env without revealing configured values", () => {
    const readiness = getTwilioSmsReadiness({
      COMMUNICATIONS_SMS_PROVIDER: "mock",
      TWILIO_ACCOUNT_SID: "AC11111111111111111111111111111111",
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.senderMode).toBe("missing");
    expect(readiness.missing).toEqual([
      "COMMUNICATIONS_SMS_PROVIDER",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_FROM_NUMBER",
      "TWILIO_MESSAGING_SERVICE_SID",
    ]);
    expect(JSON.stringify(readiness)).not.toContain(
      "AC11111111111111111111111111111111",
    );
  });

  it("warns when optional sender override may change Twilio behaviour", () => {
    const readiness = getTwilioSmsReadiness({
      COMMUNICATIONS_SMS_PROVIDER: "twilio",
      TWILIO_ACCOUNT_SID: "AC11111111111111111111111111111111",
      TWILIO_AUTH_TOKEN: "super-secret-token",
      TWILIO_FROM_NUMBER: "+447700900000",
      COMMUNICATIONS_DEFAULT_FROM_SMS: "+447700900999",
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.warnings.join(" ")).toContain(
      "COMMUNICATIONS_DEFAULT_FROM_SMS",
    );
  });
});
