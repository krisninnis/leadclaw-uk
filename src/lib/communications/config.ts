// Communications layer configuration.
//
// Reads COMMUNICATIONS_* env vars and resolves the active provider per channel.
// Defaults are chosen so that:
//   * email keeps working via the existing Resend path (default "resend");
//   * SMS / WhatsApp are OFF by default — an unset provider yields a graceful
//     "provider_not_configured" rather than a crash or an accidental send.
//
// No env var here is required: a missing value falls back to a safe default and
// the build never fails because of communications config.

import type { CommunicationProvider } from "./types";

export type EmailProviderName = "resend" | "mock";
export type SmsProviderName =
  | "mock"
  | "twilio"
  | "telnyx"
  | "vonage"
  | "plivo"
  | "none";
export type WhatsAppProviderName =
  | "mock"
  | "whatsapp_cloud"
  | "twilio"
  | "none";

function envLower(key: string): string | undefined {
  const v = process.env[key]?.trim().toLowerCase();
  return v ? v : undefined;
}

/** Email provider — defaults to Resend so existing behaviour is preserved. */
export function getEmailProviderName(): EmailProviderName {
  return envLower("COMMUNICATIONS_EMAIL_PROVIDER") === "mock" ? "mock" : "resend";
}

/**
 * SMS provider — defaults to "none" (unset). Only "mock" is wired in Phase 1;
 * the real vendors are accepted as values but resolve to a not-configured stub
 * until their adapters land in Phase 2.
 */
export function getSmsProviderName(): SmsProviderName {
  const v = envLower("COMMUNICATIONS_SMS_PROVIDER");
  switch (v) {
    case "mock":
    case "twilio":
    case "telnyx":
    case "vonage":
    case "plivo":
      return v;
    default:
      return "none";
  }
}

/** WhatsApp provider — defaults to "none" (unset). Only "mock" wired in Phase 1. */
export function getWhatsAppProviderName(): WhatsAppProviderName {
  const v = envLower("COMMUNICATIONS_WHATSAPP_PROVIDER");
  switch (v) {
    case "mock":
    case "whatsapp_cloud":
    case "twilio":
      return v;
    default:
      return "none";
  }
}

/** Default outbound email sender (falls back to the existing Resend from-address). */
export function getDefaultFromEmail(): string | undefined {
  return (
    process.env.COMMUNICATIONS_DEFAULT_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    undefined
  );
}

/** Default outbound SMS sender (E.164 or messaging-service id). */
export function getDefaultFromSms(): string | undefined {
  return process.env.COMMUNICATIONS_DEFAULT_FROM_SMS?.trim() || undefined;
}

/**
 * Internal recipient for founder / lead-notification alerts. Mirrors the
 * existing default used by sendFounderAlertEmail so behaviour is unchanged.
 */
export function getInternalAlertRecipient(): string {
  return process.env.FOUNDER_ALERT_EMAIL?.trim() || "krisninnis@gmail.com";
}

/** Map an SMS provider name onto the persisted provider id (for the event log). */
export function smsProviderId(
  name: SmsProviderName,
): CommunicationProvider | null {
  return name === "none" ? null : name;
}

/** Map a WhatsApp provider name onto the persisted provider id. */
export function whatsAppProviderId(
  name: WhatsAppProviderName,
): CommunicationProvider | null {
  return name === "none" ? null : name;
}
