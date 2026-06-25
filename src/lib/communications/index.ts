// LeadClaw Communications Layer — public surface.
//
// The rest of the app imports ONLY from "@/lib/communications". Provider
// selection, event logging and graceful not-configured behaviour all live
// behind these functions. Nothing here throws for an expected failure; callers
// branch on `result.ok`.

import {
  getDefaultFromEmail,
  getDefaultFromSms,
  getEmailProviderName,
  getInternalAlertRecipient,
  getSmsProviderName,
  getWhatsAppProviderName,
  smsProviderId,
  whatsAppProviderId,
} from "./config";
import { recordCommunicationEvent } from "./events";
import { MockProvider } from "./providers/mock";
import { ResendEmailProvider } from "./providers/resend";
import { TwilioSmsProvider } from "./providers/twilio";
import type {
  EmailProvider,
  SmsProvider,
  WhatsAppProvider,
} from "./provider";
import type {
  CommunicationResult,
  LeadNotificationEmailInput,
  RecordVoicemailInput,
  SendSmsInput,
  SendWhatsAppInput,
  TrialLifecycleEmailInput,
} from "./types";

export * from "./types";
export type {
  EmailProvider,
  SmsProvider,
  WhatsAppProvider,
  BaseProvider,
} from "./provider";
export {
  recordCommunicationEvent,
  buildBodyPreview,
  buildEventRow,
} from "./events";
export { MockProvider } from "./providers/mock";
export { ResendEmailProvider } from "./providers/resend";
export { TwilioSmsProvider } from "./providers/twilio";

// --- Provider factories ----------------------------------------------------
// Cached singletons; reset via __resetCommunicationsProviders() in tests.

let emailProvider: EmailProvider | null = null;
let mockProvider: MockProvider | null = null;
let twilioSmsProvider: TwilioSmsProvider | null = null;

function getMockProvider(): MockProvider {
  if (!mockProvider) mockProvider = new MockProvider();
  return mockProvider;
}

export function getEmailProvider(): EmailProvider {
  if (emailProvider) return emailProvider;
  emailProvider =
    getEmailProviderName() === "mock"
      ? getMockProvider()
      : new ResendEmailProvider();
  return emailProvider;
}

/** Returns the SMS provider, or null when none is configured. */
function getSmsProvider(): SmsProvider | null {
  const name = getSmsProviderName();
  if (name === "none") return null;
  if (name === "mock") return getMockProvider();
  if (name === "twilio") {
    if (!twilioSmsProvider) twilioSmsProvider = new TwilioSmsProvider();
    return twilioSmsProvider;
  }
  // telnyx / vonage / plivo adapters arrive in a later phase.
  return null;
}

/** Returns the WhatsApp provider, or null when none is configured (Phase 1). */
function getWhatsAppProvider(): WhatsAppProvider | null {
  const name = getWhatsAppProviderName();
  if (name === "none") return null;
  if (name === "mock") return getMockProvider();
  // whatsapp_cloud / twilio adapters arrive in Phase 2.
  return null;
}

/** Test-only: clear cached providers (and the shared mock's recorded sends). */
export function __resetCommunicationsProviders(): void {
  emailProvider = null;
  mockProvider?.reset();
  mockProvider = null;
  twilioSmsProvider = null;
}

// --- Internal email rendering ---------------------------------------------

/** Render the founder/lead-notification alert (mirrors the legacy template). */
function renderAlertEmail(input: LeadNotificationEmailInput): {
  html: string;
  text: string;
} {
  const safeLines = input.lines.filter(
    (line) =>
      line.value !== null &&
      line.value !== undefined &&
      String(line.value).trim() !== "",
  );

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:16px;">${input.title}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <tbody>
          ${safeLines
            .map(
              (line) => `
                <tr>
                  <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;width:180px;background:#f8fafc;">
                    ${line.label}
                  </td>
                  <td style="padding:8px 12px;border:1px solid #e2e8f0;">
                    ${String(line.value)}
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  const text = [
    input.title,
    ...safeLines.map((line) => `${line.label}: ${line.value}`),
  ].join("\n");

  return { html, text };
}

// --- Service functions -----------------------------------------------------

/**
 * Send an internal lead / founder notification email through the active email
 * provider and log it to communication_events (best-effort). Behaviour-
 * preserving replacement for direct sendFounderAlertEmail() calls.
 */
export async function sendLeadNotificationEmail(
  input: LeadNotificationEmailInput,
): Promise<CommunicationResult> {
  const provider = getEmailProvider();
  const to = input.to || getInternalAlertRecipient();
  const { html, text } = renderAlertEmail(input);

  const result = await provider.sendEmail({
    to,
    subject: input.title,
    html,
    text,
    from: getDefaultFromEmail(),
    tags: input.tags,
    context: input.context,
  });

  await recordCommunicationEvent({
    channel: "email",
    direction: "outbound",
    provider: result.provider,
    status: result.ok ? "sent" : "failed",
    toAddress: to,
    fromAddress: getDefaultFromEmail() ?? null,
    subject: input.title,
    bodyPreview: text,
    providerMessageId: result.ok ? result.providerMessageId : null,
    errorMessage: result.ok ? null : result.detail ?? result.error,
    leadId: input.context?.leadId ?? null,
    clinicId: input.context?.clinicId ?? null,
    enquiryId: input.context?.enquiryId ?? null,
    metadata: input.context?.metadata,
  });

  return result;
}

/**
 * Send a trial lifecycle email (welcome / nudge / expiry) through the active
 * email provider and log it. Caller supplies fully-rendered html/text.
 */
export async function sendTrialLifecycleEmail(
  input: TrialLifecycleEmailInput,
): Promise<CommunicationResult> {
  const provider = getEmailProvider();

  const result = await provider.sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    from: getDefaultFromEmail(),
    tags: input.tags,
    context: input.context,
  });

  await recordCommunicationEvent({
    channel: "email",
    direction: "outbound",
    provider: result.provider,
    status: result.ok ? "sent" : "failed",
    toAddress: input.to,
    fromAddress: getDefaultFromEmail() ?? null,
    subject: input.subject,
    bodyPreview: input.text ?? input.subject,
    providerMessageId: result.ok ? result.providerMessageId : null,
    errorMessage: result.ok ? null : result.detail ?? result.error,
    leadId: input.context?.leadId ?? null,
    clinicId: input.context?.clinicId ?? null,
    enquiryId: input.context?.enquiryId ?? null,
    metadata: input.context?.metadata,
  });

  return result;
}

/**
 * Send an SMS. Phase 1: returns provider_not_configured unless a provider is
 * configured (mock for dev/tests). Never throws; logs the attempt.
 */
export async function sendSms(input: SendSmsInput): Promise<CommunicationResult> {
  const provider = getSmsProvider();

  if (!provider) {
    return {
      ok: false,
      channel: "sms",
      provider: smsProviderId(getSmsProviderName()) ?? "mock",
      error: "provider_not_configured",
      detail: `SMS provider "${getSmsProviderName()}" not available in Phase 1`,
    };
  }

  const result = await provider.sendSms({
    ...input,
    from: input.from ?? getDefaultFromSms(),
  });

  const eventId = await recordCommunicationEvent({
    channel: "sms",
    direction: "outbound",
    provider: result.provider,
    status: result.ok ? "sent" : "failed",
    toAddress: input.to,
    fromAddress: input.from ?? getDefaultFromSms() ?? null,
    bodyPreview: input.body,
    providerMessageId: result.ok ? result.providerMessageId : null,
    errorMessage: result.ok ? null : result.detail ?? result.error,
    leadId: input.context?.leadId ?? null,
    clinicId: input.context?.clinicId ?? null,
    enquiryId: input.context?.enquiryId ?? null,
    metadata: input.context?.metadata,
  });

  if (result.ok) {
    return {
      ...result,
      eventId,
    };
  }

  return result;
}

/**
 * Send a WhatsApp message. Phase 1: returns provider_not_configured unless a
 * provider is configured (mock for dev/tests). Never throws; logs the attempt.
 */
export async function sendWhatsApp(
  input: SendWhatsAppInput,
): Promise<CommunicationResult> {
  const provider = getWhatsAppProvider();

  if (!provider) {
    return {
      ok: false,
      channel: "whatsapp",
      provider: whatsAppProviderId(getWhatsAppProviderName()) ?? "mock",
      error: "provider_not_configured",
      detail: `WhatsApp provider "${getWhatsAppProviderName()}" not available in Phase 1`,
    };
  }

  const result = await provider.sendWhatsApp({
    ...input,
    from: input.from ?? getDefaultFromSms(),
  });

  await recordCommunicationEvent({
    channel: "whatsapp",
    direction: "outbound",
    provider: result.provider,
    status: result.ok ? "sent" : "failed",
    toAddress: input.to,
    fromAddress: input.from ?? getDefaultFromSms() ?? null,
    bodyPreview: input.body,
    providerMessageId: result.ok ? result.providerMessageId : null,
    errorMessage: result.ok ? null : result.detail ?? result.error,
    leadId: input.context?.leadId ?? null,
    clinicId: input.context?.clinicId ?? null,
    enquiryId: input.context?.enquiryId ?? null,
    metadata: input.context?.metadata,
  });

  return result;
}

/**
 * Record an inbound voicemail as a communication event. Phase 1 stub: it does
 * NOT download or store the recording — it logs receipt so the event exists for
 * later phases (capture / transcription / lead creation). Never throws.
 */
export async function recordInboundVoicemail(
  input: RecordVoicemailInput,
): Promise<CommunicationResult> {
  const provider = input.provider ?? "mock";

  const eventId = await recordCommunicationEvent({
    channel: "voicemail",
    direction: "inbound",
    provider,
    status: "received",
    fromAddress: input.from,
    toAddress: input.to,
    bodyPreview: input.transcript ?? null,
    metadata: {
      ...(input.context?.metadata ?? {}),
      durationSeconds: input.durationSeconds ?? null,
      hasRecording: Boolean(input.recordingUrl),
    },
    leadId: input.context?.leadId ?? null,
    clinicId: input.context?.clinicId ?? null,
    enquiryId: input.context?.enquiryId ?? null,
  });

  return {
    ok: true,
    channel: "voicemail",
    provider,
    providerMessageId: null,
    eventId,
  };
}
