// No-op telephony provider for tests and local development.
//
// Records outbound sends in-memory instead of hitting a real API, and accepts
// any webhook signature. Never performs network I/O.

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

export type RecordedSms = SendSmsInput & { providerMessageId: string };

export class TestTelephonyProvider implements TelephonyProvider {
  readonly name = "test";
  readonly sent: RecordedSms[] = [];

  private counter = 0;

  isConfigured(): boolean {
    return true;
  }

  normalisePhoneNumber(value: string | null | undefined): string | null {
    return normalisePhoneNumber(value);
  }

  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    this.counter += 1;
    const providerMessageId = `test-msg-${this.counter}`;
    this.sent.push({ ...input, providerMessageId });
    return { ok: true, provider: this.name, providerMessageId };
  }

  validateWebhookSignature(_input: WebhookSignatureInput): SignatureCheck {
    return { valid: true, reason: "valid" };
  }

  parseInboundVoiceWebhook(params: WebhookParams): ParsedVoiceWebhook {
    return {
      providerCallId: params.CallSid || null,
      fromRaw: params.From || null,
      toRaw: params.To || null,
      callStatus: params.CallStatus || null,
    };
  }

  parseInboundSmsWebhook(params: WebhookParams): ParsedInboundSms {
    return {
      providerMessageId: params.MessageSid || null,
      fromRaw: params.From || null,
      toRaw: params.To || null,
      body: params.Body || "",
    };
  }

  parseMessageStatusWebhook(params: WebhookParams): ParsedMessageStatus {
    return {
      providerMessageId: params.MessageSid || null,
      deliveryStatus: params.MessageStatus || null,
      errorCode: params.ErrorCode || null,
    };
  }
}
