// Twilio implementation of the TelephonyProvider interface.
//
// Deliberately uses the Twilio REST API over `fetch` and Node's `crypto` rather
// than the official SDK, so:
//   * no extra dependency is added to the build;
//   * missing env vars never throw at import time — they surface as clear
//     runtime errors from sendSms()/isConfigured().
//
// Webhook bodies from Twilio are `application/x-www-form-urlencoded`; the route
// is responsible for parsing the body into WebhookParams (so the body is read
// exactly once) before calling the parse/validate methods here.

import crypto from "crypto";
import { normalisePhoneNumber } from "./phone";
import type {
  ParsedInboundSms,
  ParsedMessageStatus,
  ParsedVoiceWebhook,
  SendSmsInput,
  SendSmsResult,
  SignatureCheck,
  TelephonyProvider,
  WebhookParams,
  WebhookSignatureInput,
} from "./types";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string | null;
  messagingServiceSid: string | null;
};

function readConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) return null;

  return {
    accountSid,
    authToken,
    fromNumber: process.env.TWILIO_FROM_NUMBER?.trim() || null,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || null,
  };
}

/**
 * Compute the Twilio request signature for a URL + POST params.
 * Algorithm: take the full URL, append every POST param sorted alphabetically
 * by key as `key + value` (no separators), HMAC-SHA1 with the auth token, then
 * base64-encode.
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: WebhookParams,
): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  return crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export class TwilioProvider implements TelephonyProvider {
  readonly name = "twilio";

  isConfigured(): boolean {
    return readConfig() !== null;
  }

  normalisePhoneNumber(value: string | null | undefined): string | null {
    return normalisePhoneNumber(value);
  }

  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    const config = readConfig();
    if (!config) {
      return { ok: false, provider: this.name, error: "twilio_not_configured" };
    }

    const to = normalisePhoneNumber(input.to);
    if (!to) {
      return { ok: false, provider: this.name, error: "invalid_to_number" };
    }

    const body = new URLSearchParams();
    body.set("To", to);
    body.set("Body", input.body);

    const from = input.from?.trim() || config.fromNumber;
    if (config.messagingServiceSid) {
      body.set("MessagingServiceSid", config.messagingServiceSid);
    } else if (from) {
      body.set("From", from);
    } else {
      return { ok: false, provider: this.name, error: "no_sender_configured" };
    }

    const auth = Buffer.from(
      `${config.accountSid}:${config.authToken}`,
    ).toString("base64");

    try {
      const res = await fetch(
        `${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        },
      );

      const json = (await res.json().catch(() => ({}))) as {
        sid?: string;
        message?: string;
        code?: number;
      };

      if (!res.ok) {
        return {
          ok: false,
          provider: this.name,
          error: json.message || `twilio_http_${res.status}`,
        };
      }

      return {
        ok: true,
        provider: this.name,
        providerMessageId: json.sid ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        error: error instanceof Error ? error.message : "twilio_request_failed",
      };
    }
  }

  validateWebhookSignature(input: WebhookSignatureInput): SignatureCheck {
    const config = readConfig();
    if (!config) {
      // No auth token available — cannot validate. Caller decides whether to
      // proceed (dev/local) or reject. We never throw.
      return { valid: false, reason: "not_configured" };
    }

    if (!input.signature) {
      return { valid: false, reason: "missing_signature" };
    }

    const expected = computeTwilioSignature(
      config.authToken,
      input.url,
      input.params,
    );

    return timingSafeEqual(expected, input.signature)
      ? { valid: true, reason: "valid" }
      : { valid: false, reason: "invalid" };
  }

  parseInboundVoiceWebhook(params: WebhookParams): ParsedVoiceWebhook {
    return {
      providerCallId: params.CallSid || null,
      fromRaw: params.From || params.Caller || null,
      toRaw: params.To || params.Called || null,
      callStatus: params.CallStatus || null,
    };
  }

  parseInboundSmsWebhook(params: WebhookParams): ParsedInboundSms {
    return {
      providerMessageId: params.MessageSid || params.SmsSid || null,
      fromRaw: params.From || null,
      toRaw: params.To || null,
      body: params.Body || "",
    };
  }

  parseMessageStatusWebhook(params: WebhookParams): ParsedMessageStatus {
    return {
      providerMessageId: params.MessageSid || params.SmsSid || null,
      deliveryStatus: params.MessageStatus || params.SmsStatus || null,
      errorCode: params.ErrorCode || null,
    };
  }
}
