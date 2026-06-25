// LeadClaw Communications Layer — domain model.
//
// Phase 1 goal: stop the rest of the app from talking to a single comms vendor
// directly. Callers use the service functions in `index.ts` (sendLeadNotification-
// Email, sendSms, sendWhatsApp, recordCommunicationEvent, ...) and never import a
// provider SDK. Providers (Resend, Twilio, Telnyx, Vonage, Plivo, WhatsApp Cloud,
// or a mock) sit behind the adapter interfaces in `provider.ts`.
//
// This file intentionally contains ONLY types + small literal unions so it is
// safe to import from anywhere (routes, lib, tests) with zero runtime cost.

/** The medium a message travels over. */
export type CommunicationChannel =
  | "email"
  | "sms"
  | "whatsapp"
  | "voice"
  | "voicemail";

/** Who initiated the message relative to LeadClaw / the clinic. */
export type CommunicationDirection = "inbound" | "outbound";

/** Lifecycle state of a single communication. */
export type CommunicationStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "received";

/** Concrete vendor (or mock) that handled a communication. */
export type CommunicationProvider =
  | "resend"
  | "twilio"
  | "telnyx"
  | "vonage"
  | "plivo"
  | "whatsapp_cloud"
  | "mock";

/** Stable machine error codes returned by the layer (never throws to callers). */
export type CommunicationErrorCode =
  | "provider_not_configured"
  | "send_failed"
  | "invalid_recipient"
  | "suppressed"
  | "unknown_error";

/** Optional tag forwarded to providers that support them (e.g. Resend). */
export type CommunicationTag = { name: string; value: string };

/**
 * Tenant / lead context attached to a communication for the event log.
 * All fields optional — internal founder alerts have no clinic or lead.
 */
export type CommunicationContext = {
  clinicId?: string | null;
  workspaceId?: string | null;
  leadId?: string | null;
  enquiryId?: string | null;
  /** Free-form labels persisted into communication_events.metadata. */
  metadata?: Record<string, unknown>;
};

/** Outbound email request handed to the email provider. */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Defaults to the configured default-from email when omitted. */
  from?: string;
  tags?: CommunicationTag[];
  context?: CommunicationContext;
};

/** Outbound SMS request handed to the SMS provider. */
export type SendSmsInput = {
  to: string;
  body: string;
  /** Defaults to the configured default-from SMS sender when omitted. */
  from?: string;
  context?: CommunicationContext;
};

/** Outbound WhatsApp request handed to the WhatsApp provider. */
export type SendWhatsAppInput = {
  to: string;
  /** Plain text body, or the rendered text of a template message. */
  body: string;
  /** Optional approved template name (WhatsApp Cloud / Twilio templates). */
  templateName?: string;
  from?: string;
  context?: CommunicationContext;
};

/** Internal lead / founder notification email (founder-alert shaped). */
export type LeadNotificationEmailInput = {
  title: string;
  lines: Array<{ label: string; value: string | null | undefined }>;
  /** Overrides the default internal recipient. */
  to?: string;
  tags?: CommunicationTag[];
  context?: CommunicationContext;
};

/** Trial lifecycle email (welcome, day-3 nudge, expiry, ...). */
export type TrialLifecycleEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: CommunicationTag[];
  context?: CommunicationContext;
};

/** Inbound voicemail captured from a provider webhook (Phase 3 stub for now). */
export type RecordVoicemailInput = {
  from: string;
  to: string;
  /** Provider recording URL — not downloaded/stored in Phase 1. */
  recordingUrl?: string | null;
  /** Provider transcription text, if available. */
  transcript?: string | null;
  durationSeconds?: number | null;
  provider?: CommunicationProvider;
  context?: CommunicationContext;
};

/**
 * Uniform result returned by every send/record service function.
 * Callers branch on `ok`; the layer NEVER throws for expected failures
 * (missing provider, bad recipient, vendor error).
 */
export type CommunicationResult =
  | {
      ok: true;
      channel: CommunicationChannel;
      provider: CommunicationProvider;
      /** Vendor-assigned id (Resend/Twilio message id), if any. */
      providerMessageId: string | null;
      /** Set when the layer logged the send to communication_events. */
      eventId?: string | null;
    }
  | {
      ok: false;
      channel: CommunicationChannel;
      provider: CommunicationProvider;
      error: CommunicationErrorCode;
      /** Human-readable detail for logs (never shown to end users). */
      detail?: string;
    };

/**
 * A single row destined for the communication_events table. Bodies are stored
 * as a short, redacted preview only — never the full SMS/email content.
 */
export type CommunicationEvent = {
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  provider: CommunicationProvider;
  status: CommunicationStatus;
  fromAddress?: string | null;
  toAddress?: string | null;
  subject?: string | null;
  /** Truncated, sanitised preview of the body (see buildBodyPreview). */
  bodyPreview?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  clinicId?: string | null;
  workspaceId?: string | null;
  leadId?: string | null;
  enquiryId?: string | null;
  metadata?: Record<string, unknown>;
};
