// Twilio SMS provider for the communications layer.
//
// This is a thin adapter over the EXISTING Twilio implementation in
// src/lib/telephony/twilio.ts — it does NOT re-implement Twilio access. That
// module already owns the REST call (over fetch, no SDK), the env/config check,
// phone normalisation and webhook handling for the Missed Call Recovery infra.
// Here we only translate between the telephony result shape and the
// communications-domain CommunicationResult, and map vendor errors onto the
// layer's stable error codes.
//
// Activated when COMMUNICATIONS_SMS_PROVIDER=twilio (see config.ts +
// index.ts factory). When the Twilio env vars are absent, isConfigured() is
// false and sendSms() returns provider_not_configured — matching the
// "no SMS provider" behaviour exactly.

import { TwilioProvider } from "@/lib/telephony/twilio";
import type { SmsProvider } from "../provider";
import type {
  CommunicationErrorCode,
  CommunicationResult,
  SendSmsInput,
} from "../types";

/** Map a telephony-layer error string onto a stable communications error code. */
function mapTwilioError(error: string): CommunicationErrorCode {
  switch (error) {
    case "twilio_not_configured":
    case "no_sender_configured":
      return "provider_not_configured";
    case "invalid_to_number":
      return "invalid_recipient";
    default:
      // twilio_http_*, vendor messages, twilio_request_failed, etc.
      return "send_failed";
  }
}

export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio" as const;

  // Reuse the existing, tested telephony Twilio provider for the actual send.
  private readonly telephony = new TwilioProvider();

  isConfigured(): boolean {
    return this.telephony.isConfigured();
  }

  async sendSms(input: SendSmsInput): Promise<CommunicationResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        channel: "sms",
        provider: this.name,
        error: "provider_not_configured",
        detail: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing",
      };
    }

    const result = await this.telephony.sendSms({
      to: input.to,
      body: input.body,
      from: input.from ?? null,
    });

    if (result.ok) {
      return {
        ok: true,
        channel: "sms",
        provider: this.name,
        providerMessageId: result.providerMessageId,
      };
    }

    return {
      ok: false,
      channel: "sms",
      provider: this.name,
      error: mapTwilioError(result.error),
      // Keep the raw vendor detail for logs (never shown to end users).
      detail: result.error,
    };
  }
}
