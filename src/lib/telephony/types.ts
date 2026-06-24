// Telephony provider abstraction.
//
// The rest of the application talks to telephony exclusively through the
// TelephonyProvider interface so that a second provider (e.g. Telnyx) can be
// added later without touching webhook routes or orchestration. Twilio is the
// first concrete implementation.

/** Outbound SMS request. */
export type SendSmsInput = {
  to: string;
  body: string;
  /** Optional explicit sender. Falls back to provider default / messaging service. */
  from?: string | null;
};

export type SendSmsResult =
  | { ok: true; provider: string; providerMessageId: string | null }
  | { ok: false; provider: string; error: string };

/** Already-parsed inbound webhook form parameters (key/value strings). */
export type WebhookParams = Record<string, string>;

/** Everything needed to verify a provider webhook signature. */
export type WebhookSignatureInput = {
  /** The exact public URL the provider POSTed to. */
  url: string;
  /** The parsed form parameters of the request body. */
  params: WebhookParams;
  /** The signature header supplied by the provider (may be null/missing). */
  signature: string | null;
};

export type SignatureCheck = {
  valid: boolean;
  /** Why validation passed or was skipped/failed — useful for logging. */
  reason:
    | "valid"
    | "invalid"
    | "missing_signature"
    | "not_configured";
};

/** Normalised view of an inbound voice (call) webhook. */
export type ParsedVoiceWebhook = {
  providerCallId: string | null;
  fromRaw: string | null;
  toRaw: string | null;
  callStatus: string | null;
};

/** Normalised view of an inbound SMS webhook. */
export type ParsedInboundSms = {
  providerMessageId: string | null;
  fromRaw: string | null;
  toRaw: string | null;
  body: string;
};

/** Normalised view of a message delivery-status webhook. */
export type ParsedMessageStatus = {
  providerMessageId: string | null;
  deliveryStatus: string | null;
  errorCode: string | null;
};

export interface TelephonyProvider {
  /** Stable identifier persisted on rows (e.g. "twilio", "test"). */
  readonly name: string;

  /** True when the provider has the configuration it needs to send. */
  isConfigured(): boolean;

  sendSms(input: SendSmsInput): Promise<SendSmsResult>;

  validateWebhookSignature(input: WebhookSignatureInput): SignatureCheck;

  parseInboundVoiceWebhook(params: WebhookParams): ParsedVoiceWebhook;
  parseInboundSmsWebhook(params: WebhookParams): ParsedInboundSms;
  parseMessageStatusWebhook(params: WebhookParams): ParsedMessageStatus;

  normalisePhoneNumber(value: string | null | undefined): string | null;
}
